CREATE TABLE `prediction_markets` (
	`id` int AUTO_INCREMENT NOT NULL,
	`platform` enum('polymarket','kalshi') NOT NULL,
	`externalId` varchar(255) NOT NULL,
	`title` text NOT NULL,
	`yesProbability` int NOT NULL,
	`previousProbability` int,
	`probabilityChange24h` int DEFAULT 0,
	`volume` int DEFAULT 0,
	`volume24h` int DEFAULT 0,
	`liquidity` int DEFAULT 0,
	`relatedTickers` text,
	`category` varchar(64),
	`isHot` int NOT NULL DEFAULT 0,
	`endDate` timestamp,
	`status` enum('active','resolved','closed') DEFAULT 'active',
	`resolution` varchar(50),
	`lastFetchedAt` timestamp NOT NULL DEFAULT (now()),
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `prediction_markets_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `signal_sources` (
	`id` int AUTO_INCREMENT NOT NULL,
	`handle` varchar(100) NOT NULL,
	`displayName` varchar(255) NOT NULL,
	`category` enum('investor_trader','economist_fed','politician_policy','tech_leader','financial_media','custom') NOT NULL,
	`weightMultiplier` int NOT NULL DEFAULT 3,
	`description` text,
	`isContrarian` int NOT NULL DEFAULT 0,
	`isActive` int NOT NULL DEFAULT 1,
	`addedByUserId` int,
	`followersCount` int,
	`avatarUrl` text,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `signal_sources_id` PRIMARY KEY(`id`),
	CONSTRAINT `signal_sources_handle_unique` UNIQUE(`handle`)
);
--> statement-breakpoint
CREATE TABLE `trending_topics` (
	`id` int AUTO_INCREMENT NOT NULL,
	`topic` varchar(255) NOT NULL,
	`tweetVolume` int DEFAULT 0,
	`velocity` enum('rising','stable','falling') DEFAULT 'stable',
	`sentiment` enum('bullish','bearish','neutral') DEFAULT 'neutral',
	`sentimentScore` int,
	`relatedTickers` text,
	`isBreaking` int NOT NULL DEFAULT 0,
	`category` varchar(64),
	`rank` int,
	`firstSeenAt` timestamp NOT NULL DEFAULT (now()),
	`lastUpdatedAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `trending_topics_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `vip_tweets` (
	`id` int AUTO_INCREMENT NOT NULL,
	`sourceId` int NOT NULL,
	`handle` varchar(100) NOT NULL,
	`content` text NOT NULL,
	`tickers` text,
	`sentiment` enum('bullish','bearish','neutral'),
	`sentimentScore` int,
	`triggeredPrediction` int NOT NULL DEFAULT 0,
	`relevanceScore` int,
	`likes` int DEFAULT 0,
	`retweets` int DEFAULT 0,
	`isConsumerTrend` int NOT NULL DEFAULT 0,
	`metadata` text,
	`tweetedAt` timestamp NOT NULL DEFAULT (now()),
	`ingestedAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `vip_tweets_id` PRIMARY KEY(`id`)
);
