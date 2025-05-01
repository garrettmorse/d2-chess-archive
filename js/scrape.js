import fs from 'node:fs';
import path from "node:path";
import fetch from "node-fetch";
import { HttpsProxyAgent } from 'https-proxy-agent';
import 'dotenv/config';

const BNG_URL = 'https://qu4n7um-7ime-7unne7-4aa2.bungie.workers.dev/';

const INPUT_PATH = path.resolve(process.cwd(), '../common/tj-data-best.json');
const OUTPUT_PATH = path.resolve(process.cwd(), '../common/api.json');
const PROXY_PATH = process.cwd() + '/proxies.json';

const data = JSON.parse(fs.readFileSync(INPUT_PATH, { encoding: "utf8" }));
const proxies = JSON.parse(fs.readFileSync(PROXY_PATH, { encoding: "utf8" }));

// Configure these settings based on your needs
const MAX_RETRIES = 5;
const INITIAL_BACKOFF_MS = 1000;
const MAX_BACKOFF_MS = 30000;
const JITTER_MS = 500;
const CONCURRENT_REQUESTS = 5;

// Keep track of proxy performance and errors
const proxyStats = {};
proxies.forEach(proxy => {
  proxyStats[proxy] = {
    requests: 0,
    errors: 0,
    lastUsed: 0
  };
});

// Get the best available proxy
function getBestProxy() {
  const now = Date.now();
  
  // Sort proxies by error rate and time since last use
  const sortedProxies = Object.keys(proxyStats)
    .sort((a, b) => {
      // First sort by error rate
      const errorRateA = proxyStats[a].requests > 0 ? proxyStats[a].errors / proxyStats[a].requests : 0;
      const errorRateB = proxyStats[b].requests > 0 ? proxyStats[b].errors / proxyStats[b].requests : 0;
      
      if (errorRateA !== errorRateB) return errorRateA - errorRateB;
      
      // Then by time since last use
      return proxyStats[a].lastUsed - proxyStats[b].lastUsed;
    });
  
  const proxy = sortedProxies[0];
  proxyStats[proxy].lastUsed = now;
  proxyStats[proxy].requests++;
  
  return proxy;
}

function getAgent() {
  const proxy = getBestProxy();
  return {
    agent: new HttpsProxyAgent(`http://${process.env.user}:${process.env.password}@${proxy}`),
    proxy
  };
}

function padNum(num) {
  if (num.length === 1) {
    return `000${num}`;
  }
  else if (num.length === 2) {
    return `00${num}`;
  }
  else if (num.length === 3) {
    return `0${num}`;
  }
  return num;
}

// Add randomized delay
function getRandomDelay(min, max) {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

// Exponential backoff function
async function fetchWithRetry(url, options, frequency) {
  let retries = 0;
  let backoffTime = INITIAL_BACKOFF_MS;
  
  while (retries <= MAX_RETRIES) {
    try {
      // Get a fresh proxy for each retry
      const { agent, proxy } = getAgent();
      options.agent = agent;
      
      console.log(`Attempt ${retries + 1}/${MAX_RETRIES + 1} for frequency ${frequency} using proxy ${proxy}`);
      
      const response = await fetch(url, options);
      
      // If successful, return the response
      if (response.ok) {
        return await response.json();
      }
      
      // Handle rate limiting specifically
      if (response.status === 429) {
        // Mark this proxy as having an error
        proxyStats[proxy].errors++;
        
        console.log(`Rate limited on proxy ${proxy}. Status: ${response.status}`);
        
        // Get retry-after header if it exists, or use exponential backoff
        const retryAfter = response.headers.get('retry-after');
        let waitTime = retryAfter ? parseInt(retryAfter) * 1000 : backoffTime;
        
        // Add some jitter to prevent synchronized retries
        waitTime += Math.random() * JITTER_MS;
        
        console.log(`Backing off for ${waitTime}ms before retry.`);
        await new Promise(resolve => setTimeout(resolve, waitTime));
        
        // Increase backoff for next potential retry
        backoffTime = Math.min(backoffTime * 2, MAX_BACKOFF_MS);
        retries++;
        continue;
      }
      
      // For other errors, throw to be caught below
      throw new Error(`Request failed with status ${response.status}`);
    } catch (error) {
      console.error(`Error on attempt ${retries + 1}/${MAX_RETRIES + 1}:`, error.message);
      
      if (retries >= MAX_RETRIES) {
        throw new Error(`Max retries exceeded for frequency ${frequency}: ${error.message}`);
      }
      
      // Add randomized delay with jitter before retry
      const waitTime = backoffTime + Math.random() * JITTER_MS;
      console.log(`Backing off for ${waitTime}ms before retry.`);
      await new Promise(resolve => setTimeout(resolve, waitTime));
      
      // Increase backoff for next retry
      backoffTime = Math.min(backoffTime * 2, MAX_BACKOFF_MS);
      retries++;
    }
  }
}

// Process requests in batches to control concurrency
async function processBatch(batch, mapping) {
  const results = await Promise.allSettled(batch.map(async ({ frequency, code }) => {
    try {
      const headers = {
        'X-Time-Badge': 'timeTunnel346591457',
        'Content-Type': 'application/json',
        'User-Agent': `Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/${Math.floor(Math.random() * 100) + 500}.${Math.floor(Math.random() * 50)} (KHTML, like Gecko) Chrome/${Math.floor(Math.random() * 10) + 90}.0.${Math.floor(Math.random() * 1000) + 4000}.${Math.floor(Math.random() * 100)} Safari/${Math.floor(Math.random() * 100) + 500}.${Math.floor(Math.random() * 50)}`
      };
      console.log(BNG_URL)
      const result = await fetchWithRetry(BNG_URL, {
        method: 'POST',
        body: JSON.stringify({
          input: `${frequency}${code}`
        }),
        headers
      }, frequency);
      
      // Save interim results frequently
      mapping[frequency] = result;
      mapping[frequency].fen = code
      fs.writeFileSync(OUTPUT_PATH, JSON.stringify(mapping, null, 2));
      
      console.log(`Result for frequency ${frequency}:`, result);
      return { frequency, result, success: true };
    } catch (error) {
      console.error(`Failed to process frequency ${frequency}:`, error.message);
      return { frequency, error: error.message, success: false };
    }
  }));
  
  // Add a randomized delay between batches
  await new Promise(resolve => setTimeout(resolve, getRandomDelay(1000, 3000)));
  
  return results;
}

async function main() {
  const codes = Object.values(data).map(entry => ["" + entry.sequence, entry.fen])

  console.log(codes)
  let mapping = {};
  
  try {
    mapping = JSON.parse(fs.readFileSync(OUTPUT_PATH, { encoding: 'utf8' }));
  } catch (err) {
    console.log('No existing mapping file, creating new one.');
  }
  
  // Create queue of items to process
  const queue = [];
  
  for (const [freq, code] of codes) {
    const frequency = padNum(freq);
    if (!frequency) continue;

    if (!code) continue;
    
    // Skip already processed items
    if (mapping[frequency] && mapping[frequency] !== -1) {
      console.log(`Already processed frequency ${frequency}`);
      continue;
    }
    
    queue.push({ frequency, code });
  }
  
  console.log(`Processing ${queue.length} items with concurrency of ${CONCURRENT_REQUESTS}`);
  
  // Process queue in batches
  for (let i = 0; i < queue.length; i += CONCURRENT_REQUESTS) {
    const batch = queue.slice(i, i + CONCURRENT_REQUESTS);
    console.log(`Processing batch ${Math.floor(i/CONCURRENT_REQUESTS) + 1}/${Math.ceil(queue.length/CONCURRENT_REQUESTS)}`);
    
    const results = await processBatch(batch, mapping);
    
    const successes = results.filter(r => r.status === 'fulfilled' && r.value.success).length;
    const failures = batch.length - successes;
    
    console.log(`Batch complete. Successes: ${successes}, Failures: ${failures}`);
    
    // Save progress after each batch
    fs.writeFileSync(process.cwd() + '/mapping.json', JSON.stringify(mapping, null, 2));
    
    // Output proxy stats
    console.log('Proxy Statistics:');
    Object.entries(proxyStats).forEach(([proxy, stats]) => {
      const errorRate = stats.requests > 0 ? (stats.errors / stats.requests * 100).toFixed(2) : 0;
      console.log(`${proxy}: ${stats.requests} requests, ${stats.errors} errors (${errorRate}% error rate)`);
    });
    
    // Add a longer delay between batches
    if (i + CONCURRENT_REQUESTS < queue.length) {
      const batchDelay = getRandomDelay(2000, 4000);
      console.log(`Waiting ${batchDelay}ms before next batch...`);
      await new Promise(resolve => setTimeout(resolve, batchDelay));
    }
  }
  
  console.log('All processing complete!');
}

main().catch(err => {
  console.error('Fatal error:', err);
  process.exit(1);
});