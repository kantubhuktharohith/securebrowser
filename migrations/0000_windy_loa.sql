CREATE TABLE "exam_sessions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"hall_ticket_id" uuid NOT NULL,
	"student_id" varchar NOT NULL,
	"status" varchar DEFAULT 'not_started' NOT NULL,
	"start_time" timestamp,
	"end_time" timestamp,
	"current_question" integer DEFAULT 1,
	"answers" jsonb DEFAULT '{}'::jsonb,
	"question_ids" jsonb DEFAULT '[]'::jsonb,
	"time_remaining" integer,
	"score" integer,
	"total_marks" integer,
	"is_verified" boolean DEFAULT false,
	"verification_data" jsonb,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "hall_tickets" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"hall_ticket_id" varchar NOT NULL,
	"exam_name" varchar NOT NULL,
	"exam_date" timestamp NOT NULL,
	"duration" integer NOT NULL,
	"total_questions" integer NOT NULL,
	"roll_number" varchar NOT NULL,
	"student_name" varchar NOT NULL,
	"student_email" varchar NOT NULL,
	"student_id_barcode" varchar,
	"id_card_image_url" text,
	"qr_code_data" text NOT NULL,
	"is_active" boolean DEFAULT true NOT NULL,
	"created_by" varchar NOT NULL,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now(),
	CONSTRAINT "hall_tickets_hall_ticket_id_unique" UNIQUE("hall_ticket_id")
);
--> statement-breakpoint
CREATE TABLE "monitoring_logs" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"session_id" uuid NOT NULL,
	"event_type" varchar NOT NULL,
	"event_data" jsonb,
	"timestamp" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "questions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"exam_name" varchar NOT NULL,
	"question_text" text NOT NULL,
	"options" jsonb NOT NULL,
	"correct_answer" varchar NOT NULL,
	"question_type" varchar DEFAULT 'multiple_choice' NOT NULL,
	"difficulty" varchar DEFAULT 'medium',
	"subject" varchar NOT NULL,
	"topic" varchar NOT NULL,
	"marks" integer DEFAULT 1 NOT NULL,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "security_incidents" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"session_id" uuid NOT NULL,
	"incident_type" varchar NOT NULL,
	"severity" varchar NOT NULL,
	"description" text NOT NULL,
	"metadata" jsonb,
	"snapshot_url" varchar,
	"is_resolved" boolean DEFAULT false,
	"resolved_by" varchar,
	"resolved_at" timestamp,
	"created_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "sessions" (
	"sid" varchar PRIMARY KEY NOT NULL,
	"sess" jsonb NOT NULL,
	"expire" timestamp NOT NULL
);
--> statement-breakpoint
CREATE TABLE "users" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"email" varchar,
	"first_name" varchar,
	"last_name" varchar,
	"profile_image_url" varchar,
	"role" varchar DEFAULT 'student' NOT NULL,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now(),
	CONSTRAINT "users_email_unique" UNIQUE("email")
);
--> statement-breakpoint
ALTER TABLE "exam_sessions" ADD CONSTRAINT "exam_sessions_hall_ticket_id_hall_tickets_id_fk" FOREIGN KEY ("hall_ticket_id") REFERENCES "public"."hall_tickets"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "exam_sessions" ADD CONSTRAINT "exam_sessions_student_id_users_id_fk" FOREIGN KEY ("student_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "hall_tickets" ADD CONSTRAINT "hall_tickets_created_by_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "monitoring_logs" ADD CONSTRAINT "monitoring_logs_session_id_exam_sessions_id_fk" FOREIGN KEY ("session_id") REFERENCES "public"."exam_sessions"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "security_incidents" ADD CONSTRAINT "security_incidents_session_id_exam_sessions_id_fk" FOREIGN KEY ("session_id") REFERENCES "public"."exam_sessions"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "security_incidents" ADD CONSTRAINT "security_incidents_resolved_by_users_id_fk" FOREIGN KEY ("resolved_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "IDX_session_expire" ON "sessions" USING btree ("expire");