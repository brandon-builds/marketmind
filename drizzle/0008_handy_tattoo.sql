CREATE TABLE `prediction_weights` (
	`id` int AUTO_INCREMENT NOT NULL,
	`userId` int NOT NULL,
	`name` varchar(100) NOT NULL DEFAULT 'Default',
	`socialWeight` int NOT NULL DEFAULT 25,
	`technicalWeight` int NOT NULL DEFAULT 25,
	`fundamentalWeight` int NOT NULL DEFAULT 25,
	`newsWeight` int NOT NULL DEFAULT 25,
	`isActive` int NOT NULL DEFAULT 1,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `prediction_weights_id` PRIMARY KEY(`id`)
);
