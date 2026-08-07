CREATE TABLE `user_app_data` (
	`user_id` text PRIMARY KEY NOT NULL,
	`email` text NOT NULL,
	`payload` text NOT NULL,
	`revision` integer DEFAULT 1 NOT NULL,
	`updated_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL
);
