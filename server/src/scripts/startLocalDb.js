const { MongoMemoryReplSet } = require('mongodb-memory-server');

async function main() {
  console.log('Starting local in-memory replica set rs0 on port 27017...');
  try {
    const replSet = await MongoMemoryReplSet.create({
      instanceOpts: [
        { port: 27017, storageEngine: 'wiredTiger' }
      ],
      replSet: {
        name: 'rs0',
        count: 1
      }
    });

    const uri = replSet.getUri();
    console.log(`Local replica set is READY! URI: ${uri}`);
    console.log('Press Ctrl+C to terminate.');

    process.on('SIGINT', async () => {
      console.log('Stopping replica set...');
      await replSet.stop();
      process.exit(0);
    });
  } catch (err) {
    console.error('Failed to start in-memory replica set:', err);
    process.exit(1);
  }
}

main();

