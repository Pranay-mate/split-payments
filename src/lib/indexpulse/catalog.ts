/**
 * Curated catalog of the most popular / liquid India-listed ETFs.
 * Static seed data for IndexPulse — symbols are NSE tickers WITHOUT the ".NS"
 * suffix (that suffix is added when querying Yahoo Finance). Index mutual funds
 * are sourced dynamically from AMFI, not here.
 */

import type { Instrument } from "./types";

/** Helper: build an ETF Instrument with the "etf:" key convention. */
function etf(symbol: string, name: string, category: string): Instrument {
  return { key: "etf:" + symbol, type: "etf", name, symbol, category };
}

export const ETF_CATALOG: Instrument[] = [
  etf("NIFTYBEES", "Nippon India ETF Nifty 50 BeES", "Nifty 50"),
  etf("NIFTYIETF", "ICICI Prudential Nifty 50 ETF", "Nifty 50"),
  etf("SETFNIF50", "SBI Nifty 50 ETF", "Nifty 50"),
  etf("JUNIORBEES", "Nippon India ETF Nifty Next 50 Junior BeES", "Nifty Next 50"),
  etf("BANKBEES", "Nippon India ETF Nifty Bank BeES", "Sectoral"),
  etf("PSUBNKBEES", "Nippon India ETF Nifty PSU Bank BeES", "Sectoral"),
  etf("ITBEES", "Nippon India ETF Nifty IT", "Sectoral"),
  etf("PHARMABEES", "Nippon India ETF Nifty Pharma", "Sectoral"),
  etf("CONSUMBEES", "Nippon India ETF Nifty India Consumption", "Sectoral"),
  etf("CPSEETF", "CPSE ETF", "Sectoral"),
  etf("ICICIB22", "ICICI Prudential Bharat 22 ETF", "Sectoral"),
  etf("MOM100", "Motilal Oswal Nifty Midcap 100 ETF", "Nifty 50"),
  etf("MOM50", "Motilal Oswal Nifty 50 ETF", "Nifty 50"),
  etf("GOLDBEES", "Nippon India ETF Gold BeES", "Gold"),
  etf("SILVERBEES", "Nippon India ETF Silver BeES", "Silver"),
  etf("LIQUIDBEES", "Nippon India ETF Nifty 1D Rate Liquid BeES", "Liquid"),
  etf("MON100", "Motilal Oswal NASDAQ 100 ETF", "International"),
  etf("MAFANG", "Mirae Asset NYSE FANG+ ETF", "International"),
  etf("SENSEXBEES", "Nippon India ETF Sensex BeES", "Sensex"),
];
