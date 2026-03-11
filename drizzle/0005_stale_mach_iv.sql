CREATE TABLE `user_alerts` (
	`id` int AUTO_INCREMENT NOT NULL,
	`userId` int NOT NULL,
	`ticker` varchar(16) NOT NULL,
	`type` varchar(32) NOT NULL,
	`threshold` int NOT NULL,
	`triggered` int NOT NULL DEFAULT 0,
	`triggeredAt` timestamp,
	`notified` int NOT NULL DEFAULT 0,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `user_alerts_id` PRIMARY KEY(`id`)
);
