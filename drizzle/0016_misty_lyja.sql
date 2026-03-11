CREATE TABLE `dashboard_snapshots` (
	`id` int AUTO_INCREMENT NOT NULL,
	`shareId` varchar(32) NOT NULL,
	`userId` int NOT NULL,
	`userName` varchar(255),
	`title` varchar(255),
	`data` text NOT NULL,
	`views` int NOT NULL DEFAULT 0,
	`expiresAt` timestamp,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `dashboard_snapshots_id` PRIMARY KEY(`id`),
	CONSTRAINT `dashboard_snapshots_shareId_unique` UNIQUE(`shareId`)
);
