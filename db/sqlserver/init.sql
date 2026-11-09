IF DB_ID('NotificationsTest') IS NULL CREATE DATABASE NotificationsTest;
GO
USE NotificationsTest;
GO

IF OBJECT_ID('dbo.Invoices') IS NULL
CREATE TABLE dbo.Invoices (
  InvoiceNo    NVARCHAR(30),
  CustomerCode NVARCHAR(30),
  CustomerName NVARCHAR(150),
  Email        NVARCHAR(150),
  DueDate      DATE,
  Amount       DECIMAL(18,2),
  Paid         BIT
);

IF OBJECT_ID('dbo.PurchaseOrders') IS NULL
CREATE TABLE dbo.PurchaseOrders (
  PONumber     NVARCHAR(30),
  SupplierName NVARCHAR(150),
  Email        NVARCHAR(150),
  PromisedDate DATE,
  Status       NVARCHAR(30)
);

IF OBJECT_ID('dbo.Items') IS NULL
CREATE TABLE dbo.Items (
  ItemCode     NVARCHAR(30),
  ItemName     NVARCHAR(150),
  QtyAvailable INT,
  ReorderLevel INT
);

IF OBJECT_ID('dbo.SalesSummary') IS NULL
CREATE TABLE dbo.SalesSummary (
  [Date]     DATE,
  Branch     NVARCHAR(100),
  TotalSales DECIMAL(18,2),
  Orders     INT
);
GO

IF NOT EXISTS (SELECT 1 FROM sys.server_principals WHERE name = 'readonly_user')
  CREATE LOGIN readonly_user WITH PASSWORD = '$(READONLY_PASSWORD)';
GO
USE NotificationsTest;
GO
IF NOT EXISTS (SELECT 1 FROM sys.database_principals WHERE name = 'readonly_user')
  CREATE USER readonly_user FOR LOGIN readonly_user;
ALTER ROLE db_datareader ADD MEMBER readonly_user;
DENY INSERT, UPDATE, DELETE, ALTER ON SCHEMA::dbo TO readonly_user;
GO