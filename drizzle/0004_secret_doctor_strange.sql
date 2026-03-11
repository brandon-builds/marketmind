CREATE TABLE `analytics_events` (
	`id` int AUTO_INCREMENT NOT NULL,
	`userId` int,
	`event` varchar(64) NOT NULL,
	`page` varchar(64),
	`ticker` varchar(16),
	`metadata` text,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `analytics_events_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `saved_filters` (
	`id` int AUTO_INCREMENT NOT NULL,
	`userId` int NOT NULL,
	`page` varchar(32) NOT NULL,
	`name` varchar(128) NOT NULL,
	`filters` text NOT NULL,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `saved_filters_id` PRIMARY KEY(`id`)
);
