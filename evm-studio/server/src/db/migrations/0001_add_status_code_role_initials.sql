ALTER TABLE `members` ADD `role` text;--> statement-breakpoint
ALTER TABLE `members` ADD `initials` text;--> statement-breakpoint
ALTER TABLE `projects` ADD `status` text DEFAULT 'active' NOT NULL;--> statement-breakpoint
ALTER TABLE `projects` ADD `code` text;