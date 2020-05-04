--- load with 
--- sqlite3 database.db < schema.sql

CREATE TABLE player(
	username VARCHAR(20) PRIMARY KEY,
	password VARCHAR(20),
	name VARCHAR(30),
	anime VARCHAR(30),
	email VARCHAR(30) 

);

CREATE TABLE scores(
	username VARCHAR(20),
	score INT,
	gameDate DATETIME,
	PRIMARY KEY (username, score, gameDate)
);