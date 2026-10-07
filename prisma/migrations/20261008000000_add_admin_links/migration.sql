-- CreateTable: AdminLink
--
-- Shortcuts the admin adds to the "Links" tab in the admin dashboard.
-- Each link has a name, URL, category (free-form string used as the section
-- heading), and an optional icon name (lucide-react icon key, e.g. "Github").
-- sortOrder controls ordering within a category (lower = first).
CREATE TABLE "AdminLink" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "url" TEXT NOT NULL,
    "category" TEXT NOT NULL DEFAULT 'General',
    "icon" TEXT,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "AdminLink_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "AdminLink_category_idx" ON "AdminLink"("category");
