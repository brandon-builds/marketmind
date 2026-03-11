CREATE TABLE `user_settings` (
	`id` int AUTO_INCREMENT NOT NULL,
	`userId` int NOT NULL,
	`defaultTickers` text,
	`preferredHorizon` varchar(8) DEFAULT '7d',
	`themePreference` varchar(16) DEFAULT 'dark',
	`notificationsEnabled` int DEFAULT 1,
	`emailDigest` varchar(16) DEFAULT 'none',
	`showOnboarding` int DEFAULT 1,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `user_settings_id` PRIMARY KEY(`id`),
	CONSTRAINT `user_settings_userId_unique` UNIQUE(`userId`)
);
