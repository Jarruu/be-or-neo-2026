ALTER TABLE "assignment_submissions" ADD COLUMN "text_content" TEXT;
ALTER TABLE "assignment_submissions" ALTER COLUMN "file_url" DROP NOT NULL;
