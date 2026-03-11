CREATE TABLE `onboarding_analytics` (
	`id` int AUTO_INCREMENT NOT NULL,
	`userId` int,
	`sessionId` varchar(64) NOT NULL,
	`eventType` varchar(64) NOT NULL,
	`stepNumber` int,
	`featureName` varchar(64),
	`metadata` text,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `onboarding_analytics_id` PRIMARY KEY(`id`)
);
