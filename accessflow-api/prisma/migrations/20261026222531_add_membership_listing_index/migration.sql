-- CreateIndex
CREATE INDEX "memberships_organization_id_created_at_id_idx" ON "memberships"("organization_id", "created_at", "id");

