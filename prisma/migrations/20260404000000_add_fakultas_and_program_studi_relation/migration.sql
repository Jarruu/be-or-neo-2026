CREATE TYPE "fakultas" AS ENUM (
  'PERTANIAN',
  'KEDOKTERAN',
  'MIPA',
  'PETERNAKAN',
  'TEKNIK',
  'TEKNOLOGI_PERTANIAN',
  'FARMASI',
  'TEKNOLOGI_INFORMASI',
  'KEPERAWATAN',
  'KESEHATAN_MASYARAKAT',
  'KEDOKTERAN_GIGI'
);

CREATE TABLE "program_studi" (
  "id" TEXT NOT NULL,
  "fakultas" "fakultas" NOT NULL,
  "name" VARCHAR(255) NOT NULL,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "program_studi_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "program_studi_fakultas_name_key" ON "program_studi"("fakultas", "name");

ALTER TABLE "profiles" ADD COLUMN "fakultas" "fakultas";
ALTER TABLE "profiles" ADD COLUMN "study_program_id" TEXT;

ALTER TABLE "profiles"
  ADD CONSTRAINT "profiles_study_program_id_fkey"
  FOREIGN KEY ("study_program_id") REFERENCES "program_studi"("id")
  ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "profiles" DROP COLUMN "study_program";
