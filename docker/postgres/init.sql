-- Runs once, when the Docker volume is first created.
-- A separate database keeps test runs from touching development data.
CREATE DATABASE ebook_test;
