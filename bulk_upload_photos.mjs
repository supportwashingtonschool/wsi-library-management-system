import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import dotenv from 'dotenv';
import { createClient } from '@supabase/supabase-js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// 1. Load environment variables from .env.local
const envPath = path.resolve(__dirname, '.env.local');
if (fs.existsSync(envPath)) {
  dotenv.config({ path: envPath });
} else {
  dotenv.config();
}

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseKey) {
  console.error('❌ Missing Supabase credentials in .env.local!');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);
const photosDir = path.resolve(__dirname, 'student-photos-local');

// Helper to parse filename into Surname and Grade Number
function parseFileInfo(filename) {
  const ext = path.extname(filename);
  let base = path.basename(filename, ext).trim();
  // Remove duplicate extension suffixes like "2 jpeg" or "4jpeg"
  base = base.replace(/jpeg|jpg/gi, '').trim();

  // Special cases
  if (filename === 'Cardinal_Grade 1.jpeg') return { surname: 'Cardinal', gradeNum: 1 };
  if (filename === 'Grospe J 11.jpeg') return { surname: 'Grospe', gradeNum: 11, middle: 'J' };
  if (filename.startsWith('Jeon')) return { surname: 'Jeon', gradeNum: null };
  if (filename.toLowerCase().startsWith('moreno')) return { surname: 'Moreno', gradeNum: null };

  // Match patterns like "Aralar 5", "Arguelles_Grade 1", "ROBLES G4", "Gonzales_10", "Labesig_Grade1"
  const match = base.match(/^([a-zA-Z\s.]+?)(?:_Grade\s*|\s*G|_|\s+)(\d+)$/i);
  if (match) {
    return {
      surname: match[1].trim(),
      gradeNum: parseInt(match[2], 10)
    };
  }

  // Fallback pattern "Surname Number"
  const match2 = base.match(/^([a-zA-Z\s.]+?)\s*(\d+)$/);
  if (match2) {
    return {
      surname: match2[1].trim(),
      gradeNum: parseInt(match2[2], 10)
    };
  }

  return { surname: base, gradeNum: null };
}

async function bulkUploadPhotos() {
  console.log('====================================================');
  console.log('🚀 Bulk Uploading Student Photos to Supabase Storage');
  console.log('====================================================');

  if (!fs.existsSync(photosDir)) {
    console.error(`❌ Folder "${photosDir}" does not exist.`);
    return;
  }

  const files = fs.readdirSync(photosDir);
  const imageExtensions = ['.jpg', '.jpeg', '.png', '.webp', '.gif', '.bmp', '.avif'];
  const photoFiles = files.filter(f => imageExtensions.includes(path.extname(f).toLowerCase()));

  console.log(`📁 Found ${photoFiles.length} photo(s) in ./student-photos-local/\n`);

  // Fetch all students from database
  const { data: students, error: fetchErr } = await supabase
    .from('Students')
    .select('library_id, full_name, grade_level, photo_url');

  if (fetchErr || !students) {
    console.error('❌ Failed to fetch students from Supabase:', fetchErr?.message);
    return;
  }

  console.log(`👥 Loaded ${students.length} student records from database.\n`);

  let updatedCount = 0;
  let skippedCount = 0;
  let failedCount = 0;

  for (const file of photoFiles) {
    const ext = path.extname(file);
    const filePath = path.join(photosDir, file);
    const { surname, gradeNum, middle } = parseFileInfo(file);

    // Try finding matching student
    let matchedStudent = null;

    // 1. Check exact full_name or library_id match
    const rawBase = path.basename(file, ext).trim();
    matchedStudent = students.find(s =>
      s.full_name?.toLowerCase() === rawBase.toLowerCase() ||
      s.library_id?.toLowerCase() === rawBase.toLowerCase()
    );

    // 2. Match by Surname + Grade Level
    if (!matchedStudent && surname && !file.startsWith('IMG_')) {
      const candidates = students.filter(s => {
        const gradeMatches = gradeNum !== null ? s.grade_level === `Grade ${gradeNum}` : true;
        const surnameMatches = s.full_name.toLowerCase().includes(surname.toLowerCase());
        const middleMatches = middle ? s.full_name.toLowerCase().includes(middle.toLowerCase()) : true;
        return gradeMatches && surnameMatches && middleMatches;
      });

      if (candidates.length === 1) {
        matchedStudent = candidates[0];
      }
    }

    if (!matchedStudent) {
      console.log(`⚠️ Skipped: "${file}" (no unambiguous student match found)`);
      skippedCount++;
      continue;
    }

    try {
      const fileBuffer = fs.readFileSync(filePath);
      const mimeType = ext.toLowerCase() === '.png' ? 'image/png'
        : ext.toLowerCase() === '.webp' ? 'image/webp'
        : 'image/jpeg';

      const safeStorageName = `${matchedStudent.library_id}_${Date.now()}${ext.toLowerCase()}`;

      // Upload to student-photos bucket
      const { error: uploadError } = await supabase.storage
        .from('student-photos')
        .upload(safeStorageName, fileBuffer, {
          contentType: mimeType,
          upsert: true
        });

      if (uploadError) {
        console.error(`❌ Failed to upload storage for ${matchedStudent.full_name}:`, uploadError.message);
        failedCount++;
        continue;
      }

      // Get public URL
      const { data: urlData } = supabase.storage
        .from('student-photos')
        .getPublicUrl(safeStorageName);

      const publicUrl = urlData.publicUrl;

      // Update student table
      const { error: updateError } = await supabase
        .from('Students')
        .update({ photo_url: publicUrl })
        .eq('library_id', matchedStudent.library_id);

      if (updateError) {
        console.error(`❌ Failed to update ${matchedStudent.full_name}:`, updateError.message);
        failedCount++;
      } else {
        console.log(`✅ [${matchedStudent.library_id}] ${matchedStudent.full_name} (${matchedStudent.grade_level}) <- "${file}"`);
        updatedCount++;
      }
    } catch (err) {
      console.error(`❌ Error processing "${file}":`, err.message);
      failedCount++;
    }
  }

  console.log(`\n====================================================`);
  console.log(`🎉 Finished Processing!`);
  console.log(`✅ Successfully updated: ${updatedCount} students`);
  console.log(`⚠️ Skipped (e.g. IMG_ files): ${skippedCount}`);
  if (failedCount > 0) console.log(`❌ Failed: ${failedCount}`);
  console.log(`====================================================\n`);
}

bulkUploadPhotos();
