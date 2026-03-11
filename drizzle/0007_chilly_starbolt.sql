CREATE TABLE `shared_watchlist_members` (
	`id` int AUTO_INCREMENT NOT NULL,
	`watchlistId` int NOT NULL,
	`userId` int NOT NULL,
	`role` varchar(16) NOT NULL DEFAULT 'viewer',
	`joinedAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `shared_watchlist_members_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `shared_watchlist_tickers` (
	`id` int AUTO_INCREMENT NOT NULL,
	`watchlistId` int NOT NULL,
	`ticker` varchar(16) NOT NULL,
	`addedBy` int NOT NULL,
	`addedAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `shared_watchlist_tickers_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `shared_watchlists` (
	`id` int AUTO_INCREMENT NOT NULL,
	`ownerId` int NOT NULL,
	`name` varchar(128) NOT NULL,
	`description` text,
	`inviteCode` varchar(32) NOT NULL,
	`isPublic` int NOT NULL DEFAULT 0,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `shared_watchlists_id` PRIMARY KEY(`id`),
	CONSTRAINT `shared_watchlists_inviteCode_unique` UNIQUE(`inviteCode`)
);
--> statement-breakpoint
CREATE TABLE `watchlist_annotations` (
	`id` int AUTO_INCREMENT NOT NULL,
	`watchlistId` int NOT NULL,
	`ticker` varchar(16) NOT NULL,
	`userId` int NOT NULL,
	`content` text NOT NULL,
	`sentiment` varchar(16),
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `watchlist_annotations_id` PRIMARY KEY(`id`)
);
