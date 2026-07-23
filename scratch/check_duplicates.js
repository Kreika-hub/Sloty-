const url = "https://lyieecqqktjroxgokvmg.supabase.co/rest/v1/subscriptions?select=*";
const key = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imx5aWVlY3Fxa3Rqcm94Z29rdm1nIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzYzNTU2NjQsImV4cCI6MjA5MTkzMTY2NH0.8wcb-S0Q8mG5CdcYwVkcYavKK1l-E1hBX8KS6n8AUpw";

async function run() {
  try {
    const res = await fetch(url, {
      headers: {
        "apikey": key,
        "Authorization": `Bearer ${key}`
      }
    });

    if (!res.ok) {
      throw new Error(`HTTP Error: ${res.status} ${res.statusText}`);
    }

    const data = await res.json();
    console.log(`Fetched ${data.length} subscriptions.`);

    // Group by plate and building_id to find duplicates
    const counts = {};
    for (const item of data) {
      // Split plates and check individually
      const plates = item.plate ? item.plate.split(',').map(p => p.trim().toUpperCase()).filter(Boolean) : [];
      for (const plate of plates) {
        const keyVal = `${item.building_id}#${plate}`;
        if (!counts[keyVal]) {
          counts[keyVal] = [];
        }
        counts[keyVal].push(item);
      }
    }

    let found = false;
    for (const [keyVal, list] of Object.entries(counts)) {
      if (list.length > 1) {
        found = true;
        const [bldId, plate] = keyVal.split('#');
        console.log(`\nDuplicate plates found for: Plate "${plate}" in Building ID "${bldId}":`);
        for (const sub of list) {
          console.log(`  - ID: ${sub.id}, Name: "${sub.resident_name}", Status: ${sub.status}, Expiry: ${sub.expiry_date}, Plate: "${sub.plate}"`);
        }
      }
    }

    if (!found) {
      console.log("No duplicate plate registrations found in subscriptions table.");
    }
  } catch (err) {
    console.error("Error executing script:", err);
  }
}

run();
