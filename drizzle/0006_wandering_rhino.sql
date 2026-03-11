ALTER TABLE `user_alerts` ADD `sentimentFilter` varchar(16);--> statement-breakpoint
ALTER TABLE `user_alerts` ADD `keyword` varchar(128);--> statement-breakpoint
ALTER TABLE `user_alerts` ADD `triggerContext` text;