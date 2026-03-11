CREATE TABLE `shared_reports` (
	`id` int AUTO_INCREMENT NOT NULL,
	`shareId` varchar(32) NOT NULL,
	`userId` int NOT NULL,
	`reportType` enum('backtest','portfolio') NOT NULL,
	`title` varchar(256) NOT NULL,
	`data` text NOT NULL,
	`views` int NOT NULL DEFAULT 0,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`expiresAt` timestamp,
	CONSTRAINT `shared_reports_id` PRIMARY KEY(`id`),
	CONSTRAINT `shared_reports_shareId_unique` UNIQUE(`shareId`)
);
