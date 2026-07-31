-- SEC-01: 分享令牌改为存 HMAC 摘要，避免库泄露即可直接下载。
-- 遗留明文 token 列保留为可空，由 resolveShare 首次命中时升级为 hash。

ALTER TABLE "share_links" ADD COLUMN IF NOT EXISTS "token_hash" varchar(64);
--> statement-breakpoint
ALTER TABLE "share_links" ALTER COLUMN "token" DROP NOT NULL;
--> statement-breakpoint
-- 空库/迁移占位：真实 HMAC 由应用层用 SHARE_TOKEN_PEPPER 在解析时升级写入。
UPDATE "share_links"
SET "token_hash" = md5("token" || id::text)
WHERE "token_hash" IS NULL AND "token" IS NOT NULL;
--> statement-breakpoint
UPDATE "share_links"
SET "token_hash" = md5(id::text)
WHERE "token_hash" IS NULL;
--> statement-breakpoint
ALTER TABLE "share_links" ALTER COLUMN "token_hash" SET NOT NULL;
--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "share_links_token_hash_uidx" ON "share_links" ("token_hash");
--> statement-breakpoint
-- 唯一约束占用同名索引时，必须先 DROP CONSTRAINT 再 DROP INDEX
ALTER TABLE "share_links" DROP CONSTRAINT IF EXISTS "share_links_token_unique";
--> statement-breakpoint
DROP INDEX IF EXISTS "share_links_token_unique";
