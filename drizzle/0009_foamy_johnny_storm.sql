CREATE TABLE `generated_reports` (
	`id` int AUTO_INCREMENT NOT NULL,
	`userId` int NOT NULL,
	`reportType` varchar(50) NOT NULL DEFAULT 'weekly_summary',
	`title` varchar(255) NOT NULL,
	`periodStart` timestamp NOT NULL,
	`periodEnd` timestamp NOT NULL,
	`fileUrl` text NOT NULL,
	`fileKey` text NOT NULL,
	`metadata` text,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `generated_reports_id` PRIMARY KEY(`id`)
);
