ALTER TABLE `report_schedules` ADD `deliveryMethod` varchar(64) DEFAULT 'notification' NOT NULL;--> statement-breakpoint
ALTER TABLE `report_schedules` ADD `deliveryEmail` varchar(320);--> statement-breakpoint
ALTER TABLE `report_schedules` ADD `slackWebhookUrl` text;