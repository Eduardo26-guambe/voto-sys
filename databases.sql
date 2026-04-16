-- database.sql
CREATE DATABASE IF NOT EXISTS defaultdb;
USE defaultdb;

-- Tabela de usuários
CREATE TABLE IF NOT EXISTS user(
    id INT AUTO_INCREMENT PRIMARY KEY,
    nome VARCHAR(100) NOT NULL,
    email VARCHAR(100) NOT NULL UNIQUE,
    senha VARCHAR(150) NOT NULL
);

-- Tabelas de candidatos
CREATE TABLE IF NOT EXISTS pres (
    id INT NOT NULL PRIMARY KEY,
    nome VARCHAR(25)
);

CREATE TABLE IF NOT EXISTS sec (
    id INT NOT NULL PRIMARY KEY,
    nome VARCHAR(25)
);

CREATE TABLE IF NOT EXISTS est (
    id INT NOT NULL PRIMARY KEY,
    nome VARCHAR(25)
);

-- Inserir candidatos
INSERT INTO pres (id, nome) VALUES 
(1, 'Amelia'), 
(2, 'Edson'), 
(3, 'Germano'), 
(4, 'Preciosa');

INSERT INTO sec (id, nome) VALUES 
(1, 'Archer'), 
(2, 'Cledio'), 
(3, 'David'), 
(4, 'Samira');

INSERT INTO est (id, nome) VALUES 
(1, 'Auneta'), 
(2, 'Hilario'), 
(3, 'Jose'), 
(4, 'Luana');

-- Tabelas de votos
CREATE TABLE IF NOT EXISTS p_votos(
    id INT NOT NULL AUTO_INCREMENT PRIMARY KEY,
    p_id INT NOT NULL,
    FOREIGN KEY (p_id) REFERENCES pres(id)
);

CREATE TABLE IF NOT EXISTS s_votos(
    id INT NOT NULL AUTO_INCREMENT PRIMARY KEY,
    s_id INT NOT NULL,
    FOREIGN KEY (s_id) REFERENCES sec(id)
);

CREATE TABLE IF NOT EXISTS e_votos(
    id INT NOT NULL AUTO_INCREMENT PRIMARY KEY,
    e_id INT NOT NULL,
    FOREIGN KEY (e_id) REFERENCES est(id)
);

-- Tabela de credenciais
CREATE TABLE IF NOT EXISTS credencial(
    id INT AUTO_INCREMENT PRIMARY KEY,
    user VARCHAR(50) NOT NULL UNIQUE,
    chave VARCHAR(150) NOT NULL
);

-- Inserir uma credencial inicial (opcional - senha: admin123)
-- INSERT INTO credencial (user, chave) VALUES ('admin', 