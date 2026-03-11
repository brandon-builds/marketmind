CREATE TABLE `in_app_notifications` (
	`id` int AUTO_INCREMENT NOT NULL,
	`userId` int NOT NULL,
	`type` varchar(50) NOT NULL,
	`title` varchar(255) NOT NULL,
	`body` text,
	`link` varchar(512),
	`isRead` boolean NOT NULL DEFAULT false,
	`metadata` text,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `in_app_notifications_id` PRIMARY KEY(`id`)
);
