/*M!999999\- enable the sandbox mode */ 
-- MariaDB dump 10.19  Distrib 10.11.11-MariaDB, for debian-linux-gnu (aarch64)
--
-- Host: localhost    Database: shift_notes_db
-- ------------------------------------------------------
-- Server version	10.11.11-MariaDB-0+deb12u1

/*!40101 SET @OLD_CHARACTER_SET_CLIENT=@@CHARACTER_SET_CLIENT */;
/*!40101 SET @OLD_CHARACTER_SET_RESULTS=@@CHARACTER_SET_RESULTS */;
/*!40101 SET @OLD_COLLATION_CONNECTION=@@COLLATION_CONNECTION */;
/*!40101 SET NAMES utf8mb4 */;
/*!40103 SET @OLD_TIME_ZONE=@@TIME_ZONE */;
/*!40103 SET TIME_ZONE='+00:00' */;
/*!40014 SET @OLD_UNIQUE_CHECKS=@@UNIQUE_CHECKS, UNIQUE_CHECKS=0 */;
/*!40014 SET @OLD_FOREIGN_KEY_CHECKS=@@FOREIGN_KEY_CHECKS, FOREIGN_KEY_CHECKS=0 */;
/*!40101 SET @OLD_SQL_MODE=@@SQL_MODE, SQL_MODE='NO_AUTO_VALUE_ON_ZERO' */;
/*!40111 SET @OLD_SQL_NOTES=@@SQL_NOTES, SQL_NOTES=0 */;

--
-- Table structure for table `activity_log`
--

DROP TABLE IF EXISTS `activity_log`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8mb4 */;
CREATE TABLE `activity_log` (
  `id` int(11) NOT NULL AUTO_INCREMENT,
  `user_id` int(11) NOT NULL,
  `action` varchar(100) NOT NULL,
  `table_name` varchar(50) DEFAULT NULL,
  `record_id` int(11) DEFAULT NULL,
  `details` longtext CHARACTER SET utf8mb4 COLLATE utf8mb4_bin DEFAULT NULL CHECK (json_valid(`details`)),
  `ip_address` varchar(45) DEFAULT NULL,
  `created_at` timestamp NULL DEFAULT current_timestamp(),
  PRIMARY KEY (`id`),
  KEY `user_id` (`user_id`),
  CONSTRAINT `activity_log_ibfk_1` FOREIGN KEY (`user_id`) REFERENCES `users` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB AUTO_INCREMENT=38 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `activity_log`
--

LOCK TABLES `activity_log` WRITE;
/*!40000 ALTER TABLE `activity_log` DISABLE KEYS */;
INSERT INTO `activity_log` VALUES
(1,1,'login','user',1,'null','::1','2025-07-26 04:26:45'),
(2,1,'create_shift','shift_note',2,'{\"title\":\"Admin User\'s Shift - 2025-07-26\",\"date\":\"2025-07-25\"}','::ffff:127.0.0.1','2025-07-26 04:27:35'),
(3,1,'create_user','user',2,'{\"name\":\"Zac\",\"email\":\"zac@shiftnotes.com\",\"role\":\"user\"}','::ffff:127.0.0.1','2025-07-26 04:28:09'),
(4,2,'login','user',2,'null','::ffff:127.0.0.1','2025-07-26 04:28:16'),
(5,1,'login','user',1,'null','::ffff:127.0.0.1','2025-07-26 06:25:39'),
(6,1,'create_shift','shift_note',4,'{\"title\":\"Admin User\'s Shift - 2025-07-26\",\"date\":\"2025-07-24\"}','::ffff:127.0.0.1','2025-07-26 06:26:24'),
(7,2,'login','user',2,'null','::1','2025-07-26 06:27:20'),
(8,2,'create_shift','shift_note',5,'{\"title\":\"Daily Equipment Shift Notes\",\"date\":\"2025-07-24\"}','::1','2025-07-26 06:27:46'),
(9,2,'create_shift','shift_note',6,'{\"title\":\"Daily Equipment Shift Notes\",\"date\":\"2025-07-23\"}','::1','2025-07-26 06:42:40'),
(10,2,'create_shift','shift_note',7,'{\"title\":\"Daily Equipment Shift Notes\",\"date\":\"2025-07-22\"}','::1','2025-07-26 06:51:14'),
(11,2,'create_shift','shift_note',8,'{\"title\":\"Daily Equipment Shift Notes\",\"date\":\"2025-07-21\"}','::ffff:127.0.0.1','2025-07-26 07:08:04'),
(12,2,'login','user',2,'null','::1','2025-07-26 10:07:49'),
(13,1,'login','user',1,'null','::ffff:127.0.0.1','2025-07-26 10:13:47'),
(14,1,'login','user',1,'null','::1','2025-07-26 10:19:27'),
(15,1,'login','user',1,'null','::1','2025-07-26 10:20:44'),
(16,1,'create_backup','backup',NULL,'{\"description\":\"Manual backup\",\"type\":\"manual\"}','::ffff:127.0.0.1','2025-07-26 10:29:24'),
(17,2,'login','user',2,'null','::1','2025-07-26 10:30:08'),
(18,1,'login','user',1,'null','::ffff:127.0.0.1','2025-07-26 10:32:15'),
(19,1,'update_backup_settings','settings',NULL,'{\"enabled\":true,\"frequency\":\"daily\",\"time\":\"02:00\",\"retention_days\":30}','::ffff:127.0.0.1','2025-07-26 10:32:30'),
(20,2,'login','user',2,'null','::ffff:127.0.0.1','2025-07-26 18:12:38'),
(21,2,'login','user',2,'null','::ffff:127.0.0.1','2025-07-26 18:13:54'),
(22,2,'login','user',2,'null','::ffff:127.0.0.1','2025-07-26 18:18:56'),
(23,2,'login','user',2,'null','::ffff:127.0.0.1','2025-07-26 18:34:56'),
(24,2,'update_inventory','inventory',1,'{\"product_name\":\"9300-CX Switch\",\"quantity\":12,\"old_quantity\":8}','::1','2025-07-26 18:35:40'),
(25,2,'login','user',2,'null','::ffff:127.0.0.1','2025-07-26 23:48:20'),
(26,2,'update_inventory','inventory',1,'{\"product_name\":\"9300-CX Switch\",\"quantity\":22,\"old_quantity\":12}','::ffff:127.0.0.1','2025-07-26 23:49:10'),
(27,2,'update_inventory','inventory',3,'{\"product_name\":\"PowerEdge Server\",\"quantity\":22,\"old_quantity\":3}','::ffff:127.0.0.1','2025-07-26 23:49:18'),
(28,2,'update_inventory','inventory',2,'{\"product_name\":\"SFP-DL-LC\",\"quantity\":22,\"old_quantity\":20}','::ffff:127.0.0.1','2025-07-26 23:49:22'),
(29,2,'login','user',2,'null','::ffff:127.0.0.1','2025-07-26 23:56:04'),
(30,2,'update_inventory','inventory',1,'{\"product_name\":\"9300-CX Switch\",\"quantity\":2,\"old_quantity\":22}','::ffff:127.0.0.1','2025-07-26 23:56:14'),
(31,2,'update_inventory','inventory',1,'{\"product_name\":\"9300-CX Switch\",\"quantity\":2,\"old_quantity\":2}','::ffff:127.0.0.1','2025-07-26 23:56:56'),
(32,2,'create_shift','shift_note',9,'{\"title\":\"Zac\'s Shift - 2025-07-26\",\"date\":\"2025-07-18\"}','::1','2025-07-26 23:57:13'),
(33,2,'login','user',2,'null','::ffff:127.0.0.1','2025-07-27 05:11:14'),
(34,2,'create_shift','shift_note',11,'{\"title\":\"Daily Equipment Shift Notes\",\"date\":\"2025-07-20\"}','::ffff:127.0.0.1','2025-07-27 05:12:53'),
(35,2,'login','user',2,'null','::ffff:127.0.0.1','2025-07-27 05:46:37'),
(36,2,'login','user',2,'null','::1','2025-07-27 05:48:22'),
(37,2,'create_shift','shift_note',13,'{\"title\":\"Zac\'s Shift - 2025-07-27\",\"date\":\"2025-07-21\"}','::1','2025-07-27 05:53:41');
/*!40000 ALTER TABLE `activity_log` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `file_attachments`
--

DROP TABLE IF EXISTS `file_attachments`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8mb4 */;
CREATE TABLE `file_attachments` (
  `id` int(11) NOT NULL AUTO_INCREMENT,
  `shift_note_id` int(11) DEFAULT NULL,
  `task_id` int(11) DEFAULT NULL,
  `filename` varchar(255) NOT NULL,
  `original_name` varchar(255) NOT NULL,
  `file_path` varchar(500) NOT NULL,
  `file_size` int(11) DEFAULT NULL,
  `mime_type` varchar(100) DEFAULT NULL,
  `uploaded_by` int(11) NOT NULL,
  `created_at` timestamp NULL DEFAULT current_timestamp(),
  PRIMARY KEY (`id`),
  KEY `shift_note_id` (`shift_note_id`),
  KEY `task_id` (`task_id`),
  KEY `uploaded_by` (`uploaded_by`),
  CONSTRAINT `file_attachments_ibfk_1` FOREIGN KEY (`shift_note_id`) REFERENCES `shift_notes` (`id`) ON DELETE CASCADE,
  CONSTRAINT `file_attachments_ibfk_2` FOREIGN KEY (`task_id`) REFERENCES `tasks` (`id`) ON DELETE CASCADE,
  CONSTRAINT `file_attachments_ibfk_3` FOREIGN KEY (`uploaded_by`) REFERENCES `users` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `file_attachments`
--

LOCK TABLES `file_attachments` WRITE;
/*!40000 ALTER TABLE `file_attachments` DISABLE KEYS */;
/*!40000 ALTER TABLE `file_attachments` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `inventory`
--

DROP TABLE IF EXISTS `inventory`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8mb4 */;
CREATE TABLE `inventory` (
  `id` int(11) NOT NULL AUTO_INCREMENT,
  `part_number` varchar(100) NOT NULL,
  `product_name` varchar(255) NOT NULL,
  `description` text DEFAULT NULL,
  `vendor` varchar(255) DEFAULT NULL,
  `location` varchar(100) DEFAULT NULL,
  `quantity` int(11) DEFAULT 0,
  `min_quantity` int(11) DEFAULT 0,
  `unit_price` decimal(10,2) DEFAULT NULL,
  `created_at` timestamp NULL DEFAULT current_timestamp(),
  `updated_at` timestamp NULL DEFAULT current_timestamp() ON UPDATE current_timestamp(),
  PRIMARY KEY (`id`)
) ENGINE=InnoDB AUTO_INCREMENT=4 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `inventory`
--

LOCK TABLES `inventory` WRITE;
/*!40000 ALTER TABLE `inventory` DISABLE KEYS */;
INSERT INTO `inventory` VALUES
(1,'A3233-32','9300-CX Switch','STS Crane Switch','Cisco Systems','43-S4',2,2,1500.00,'2025-07-26 04:25:30','2025-07-26 23:56:56'),
(2,'B21223','SFP-DL-LC','SFP Module','Cisco Systems','43-S4',22,5,150.00,'2025-07-26 04:25:30','2025-07-26 23:49:22'),
(3,'C12345','PowerEdge Server','Rack Server','Dell','DC-1',22,1,2500.00,'2025-07-26 04:25:30','2025-07-26 23:49:18');
/*!40000 ALTER TABLE `inventory` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `inventory_alerts`
--

DROP TABLE IF EXISTS `inventory_alerts`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8mb4 */;
CREATE TABLE `inventory_alerts` (
  `id` int(11) NOT NULL AUTO_INCREMENT,
  `inventory_id` int(11) NOT NULL,
  `alert_type` enum('low_stock','out_of_stock','expiring') NOT NULL,
  `message` text NOT NULL,
  `is_active` tinyint(1) DEFAULT 1,
  `created_at` timestamp NULL DEFAULT current_timestamp(),
  `resolved_at` timestamp NULL DEFAULT NULL,
  PRIMARY KEY (`id`),
  KEY `inventory_id` (`inventory_id`),
  CONSTRAINT `inventory_alerts_ibfk_1` FOREIGN KEY (`inventory_id`) REFERENCES `inventory` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `inventory_alerts`
--

LOCK TABLES `inventory_alerts` WRITE;
/*!40000 ALTER TABLE `inventory_alerts` DISABLE KEYS */;
/*!40000 ALTER TABLE `inventory_alerts` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `inventory_transactions`
--

DROP TABLE IF EXISTS `inventory_transactions`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8mb4 */;
CREATE TABLE `inventory_transactions` (
  `id` int(11) NOT NULL AUTO_INCREMENT,
  `inventory_id` int(11) NOT NULL,
  `user_id` int(11) NOT NULL,
  `transaction_type` enum('add','remove','adjust') NOT NULL,
  `quantity_change` int(11) NOT NULL,
  `previous_quantity` int(11) NOT NULL,
  `new_quantity` int(11) NOT NULL,
  `reason` text DEFAULT NULL,
  `shift_note_id` int(11) DEFAULT NULL,
  `created_at` timestamp NULL DEFAULT current_timestamp(),
  PRIMARY KEY (`id`),
  KEY `inventory_id` (`inventory_id`),
  KEY `user_id` (`user_id`),
  KEY `shift_note_id` (`shift_note_id`),
  CONSTRAINT `inventory_transactions_ibfk_1` FOREIGN KEY (`inventory_id`) REFERENCES `inventory` (`id`) ON DELETE CASCADE,
  CONSTRAINT `inventory_transactions_ibfk_2` FOREIGN KEY (`user_id`) REFERENCES `users` (`id`) ON DELETE CASCADE,
  CONSTRAINT `inventory_transactions_ibfk_3` FOREIGN KEY (`shift_note_id`) REFERENCES `shift_notes` (`id`) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `inventory_transactions`
--

LOCK TABLES `inventory_transactions` WRITE;
/*!40000 ALTER TABLE `inventory_transactions` DISABLE KEYS */;
/*!40000 ALTER TABLE `inventory_transactions` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `shift_notes`
--

DROP TABLE IF EXISTS `shift_notes`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8mb4 */;
CREATE TABLE `shift_notes` (
  `id` int(11) NOT NULL AUTO_INCREMENT,
  `title` varchar(255) NOT NULL,
  `date` date NOT NULL,
  `shift_type` enum('day','evening','night','weekend') DEFAULT 'day',
  `user_id` int(11) NOT NULL,
  `completed_audits` longtext CHARACTER SET utf8mb4 COLLATE utf8mb4_bin DEFAULT NULL CHECK (json_valid(`completed_audits`)),
  `content` text DEFAULT NULL,
  `created_at` timestamp NULL DEFAULT current_timestamp(),
  `updated_at` timestamp NULL DEFAULT current_timestamp() ON UPDATE current_timestamp(),
  PRIMARY KEY (`id`),
  UNIQUE KEY `unique_user_date` (`user_id`,`date`),
  CONSTRAINT `shift_notes_ibfk_1` FOREIGN KEY (`user_id`) REFERENCES `users` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB AUTO_INCREMENT=14 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `shift_notes`
--

LOCK TABLES `shift_notes` WRITE;
/*!40000 ALTER TABLE `shift_notes` DISABLE KEYS */;
INSERT INTO `shift_notes` VALUES
(12,'Zac\'s Shift - 2025-07-27','2025-07-27','day',2,NULL,NULL,'2025-07-27 05:48:10','2025-07-27 05:48:10'),
(13,'Zac\'s Shift - 2025-07-27','2025-07-21','day',2,'[\"TEL Lane WherePort\",\"Gate Lane WherePort\",\"TEL Enter/Exit WherePort Test\",\"Mechanics Availability Report\",\"QuickBase Dashboard Audit\"]','','2025-07-27 05:53:41','2025-07-27 05:53:41');
/*!40000 ALTER TABLE `shift_notes` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `task_inventory`
--

DROP TABLE IF EXISTS `task_inventory`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8mb4 */;
CREATE TABLE `task_inventory` (
  `id` int(11) NOT NULL AUTO_INCREMENT,
  `task_id` int(11) NOT NULL,
  `inventory_id` int(11) NOT NULL,
  `quantity_used` int(11) NOT NULL,
  `created_at` timestamp NULL DEFAULT current_timestamp(),
  PRIMARY KEY (`id`),
  KEY `task_id` (`task_id`),
  KEY `inventory_id` (`inventory_id`),
  CONSTRAINT `task_inventory_ibfk_1` FOREIGN KEY (`task_id`) REFERENCES `tasks` (`id`) ON DELETE CASCADE,
  CONSTRAINT `task_inventory_ibfk_2` FOREIGN KEY (`inventory_id`) REFERENCES `inventory` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `task_inventory`
--

LOCK TABLES `task_inventory` WRITE;
/*!40000 ALTER TABLE `task_inventory` DISABLE KEYS */;
/*!40000 ALTER TABLE `task_inventory` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `tasks`
--

DROP TABLE IF EXISTS `tasks`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8mb4 */;
CREATE TABLE `tasks` (
  `id` int(11) NOT NULL AUTO_INCREMENT,
  `shift_note_id` int(11) NOT NULL,
  `title` varchar(255) NOT NULL,
  `description` text DEFAULT NULL,
  `status` enum('pending','in_progress','completed') DEFAULT 'pending',
  `ticket_number` varchar(100) DEFAULT NULL,
  `parts_used` text DEFAULT NULL,
  `blocker_reason` text DEFAULT NULL,
  `created_at` timestamp NULL DEFAULT current_timestamp(),
  `updated_at` timestamp NULL DEFAULT current_timestamp() ON UPDATE current_timestamp(),
  PRIMARY KEY (`id`),
  KEY `shift_note_id` (`shift_note_id`),
  CONSTRAINT `tasks_ibfk_1` FOREIGN KEY (`shift_note_id`) REFERENCES `shift_notes` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB AUTO_INCREMENT=16 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `tasks`
--

LOCK TABLES `tasks` WRITE;
/*!40000 ALTER TABLE `tasks` DISABLE KEYS */;
INSERT INTO `tasks` VALUES
(13,13,'Testing 123','Testing 123 vTesting 12 Testing 123 Testing 123 Testing 123 Testing 123Testing 123Testing 123Testing 123 Testing 123Testing 123Testing 123Testing 123 Testing 123 3','pending','RITM1234565',NULL,NULL,'2025-07-27 05:53:41','2025-07-27 05:53:41'),
(14,13,'Testing 123','Testing 123Testing 123Testing 123Testing 123Testing 123Testing 123Testing 123Testing 123Testing 123Testing 123Testing 123','pending','RITM',NULL,NULL,'2025-07-27 05:53:41','2025-07-27 05:53:41'),
(15,13,'','','pending','',NULL,NULL,'2025-07-27 05:53:41','2025-07-27 05:53:41');
/*!40000 ALTER TABLE `tasks` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `users`
--

DROP TABLE IF EXISTS `users`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8mb4 */;
CREATE TABLE `users` (
  `id` int(11) NOT NULL AUTO_INCREMENT,
  `name` varchar(255) NOT NULL,
  `email` varchar(255) NOT NULL,
  `password_hash` varchar(255) NOT NULL,
  `role` enum('user','manager','admin') DEFAULT 'user',
  `active` tinyint(1) DEFAULT 1,
  `last_login` datetime DEFAULT NULL,
  `created_at` timestamp NULL DEFAULT current_timestamp(),
  `updated_at` timestamp NULL DEFAULT current_timestamp() ON UPDATE current_timestamp(),
  PRIMARY KEY (`id`),
  UNIQUE KEY `email` (`email`)
) ENGINE=InnoDB AUTO_INCREMENT=3 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `users`
--

LOCK TABLES `users` WRITE;
/*!40000 ALTER TABLE `users` DISABLE KEYS */;
INSERT INTO `users` VALUES
(1,'Admin User','admin@shiftnotes.com','$2b$10$pcqIADtVz5IJ4lS/v3.IXOlTQUEY.27yIwdhBo2MJkIwV6xcDQAva','admin',1,NULL,'2025-07-26 04:25:30','2025-07-26 04:25:30'),
(2,'Zac','zac@shiftnotes.com','$2b$12$DS.t/E4G3Fzx6Od83MbvB./vGTD2NRQlJQfqCWETsJwvZWba8n7dm','user',1,NULL,'2025-07-26 04:28:09','2025-07-26 04:28:09');
/*!40000 ALTER TABLE `users` ENABLE KEYS */;
UNLOCK TABLES;
/*!40103 SET TIME_ZONE=@OLD_TIME_ZONE */;

/*!40101 SET SQL_MODE=@OLD_SQL_MODE */;
/*!40014 SET FOREIGN_KEY_CHECKS=@OLD_FOREIGN_KEY_CHECKS */;
/*!40014 SET UNIQUE_CHECKS=@OLD_UNIQUE_CHECKS */;
/*!40101 SET CHARACTER_SET_CLIENT=@OLD_CHARACTER_SET_CLIENT */;
/*!40101 SET CHARACTER_SET_RESULTS=@OLD_CHARACTER_SET_RESULTS */;
/*!40101 SET COLLATION_CONNECTION=@OLD_COLLATION_CONNECTION */;
/*!40111 SET SQL_NOTES=@OLD_SQL_NOTES */;

-- Dump completed on 2025-07-27  2:00:02
