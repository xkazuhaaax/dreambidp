-- Migration: Add new property fields to properties table
-- Date: 2026-02-23

ALTER TABLE properties 
ADD COLUMN IF NOT EXISTS estimated_market_value DECIMAL(15, 2),
ADD COLUMN IF NOT EXISTS built_up_area DECIMAL(10, 2),
ADD COLUMN IF NOT EXISTS total_area DECIMAL(10, 2),
ADD COLUMN IF NOT EXISTS emd DECIMAL(15, 2),
ADD COLUMN IF NOT EXISTS possession_type VARCHAR(100),
ADD COLUMN IF NOT EXISTS application_end_date TIMESTAMP,
ADD COLUMN IF NOT EXISTS auction_time TIME;

-- Add comments to describe the new columns
COMMENT ON COLUMN properties.estimated_market_value IS 'Estimated Market Value of the property';
COMMENT ON COLUMN properties.built_up_area IS 'Built-up area in square feet';
COMMENT ON COLUMN properties.total_area IS 'Total area in square feet';
COMMENT ON COLUMN properties.emd IS 'Earnest Money Deposit required';
COMMENT ON COLUMN properties.possession_type IS 'Type of possession (Physical, Virtual, etc.)';
COMMENT ON COLUMN properties.application_end_date IS 'End date for property applications';
COMMENT ON COLUMN properties.auction_time IS 'Time of auction on the auction date';
