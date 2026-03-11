CREATE TABLE `agent_runs` (
	`id` int AUTO_INCREMENT NOT NULL,
	`agentType` enum('research','improvement','ingestion') NOT NULL,
	`status` enum('running','completed','failed') NOT NULL,
	`signalsProcessed` int DEFAULT 0,
	`narrativesGenerated` int DEFAULT 0,
	`predictionsGenerated` int DEFAULT 0,
	`errorMessage` text,
	`startedAt` timestamp NOT NULL DEFAULT (now()),
	`completedAt` timestamp,
	`metadata` text,
	CONSTRAINT `agent_runs_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `ai_narratives` (
	`id` int AUTO_INCREMENT NOT NULL,
	`narrativeId` varchar(100) NOT NULL,
	`title` varchar(255) NOT NULL,
	`summary` text NOT NULL,
	`sentiment` enum('bullish','bearish','neutral') NOT NULL,
	`confidence` int NOT NULL,
	`sources` text NOT NULL,
	`relatedTickers` text NOT NULL,
	`category` varchar(100) NOT NULL,
	`generatedAt` timestamp NOT NULL DEFAULT (now()),
	`agentVersion` varchar(50),
	`signalCount` int DEFAULT 0,
	CONSTRAINT `ai_narratives_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `ai_predictions` (
	`id` int AUTO_INCREMENT NOT NULL,
	`predictionId` varchar(100) NOT NULL,
	`ticker` varchar(20) NOT NULL,
	`direction` enum('up','down','neutral') NOT NULL,
	`horizon` enum('1D','7D','30D') NOT NULL,
	`confidence` int NOT NULL,
	`reasoning` text NOT NULL,
	`priceTarget` int,
	`priceAtPrediction` int,
	`category` varchar(100),
	`generatedAt` timestamp NOT NULL DEFAULT (now()),
	`agentVersion` varchar(50),
	`outcome` enum('correct','incorrect','pending') DEFAULT 'pending',
	`priceAtResolution` int,
	`resolvedAt` timestamp,
	`accuracyScore` int,
	CONSTRAINT `ai_predictions_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `ingested_signals` (
	`id` int AUTO_INCREMENT NOT NULL,
	`source` enum('reddit','yahoo_finance','rss_news','twitter') NOT NULL,
	`sourceDetail` varchar(255),
	`ticker` varchar(20),
	`title` text,
	`content` text,
	`url` varchar(500),
	`author` varchar(255),
	`sentiment` enum('bullish','bearish','neutral'),
	`sentimentScore` int,
	`signalType` enum('price_data','social_mention','news_headline','volume_spike','fundamental'),
	`metadata` text,
	`ingestedAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `ingested_signals_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `model_versions` (
	`id` int AUTO_INCREMENT NOT NULL,
	`version` varchar(50) NOT NULL,
	`accuracy` int,
	`totalPredictions` int DEFAULT 0,
	`correctPredictions` int DEFAULT 0,
	`weights` text NOT NULL,
	`changelog` text,
	`trainedAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `model_versions_id` PRIMARY KEY(`id`)
);
