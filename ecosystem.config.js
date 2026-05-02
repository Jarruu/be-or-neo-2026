module.exports = {
  apps : [{
    name: "b3-backend",
    script: "./dist/src/main.js",
    instances: 4,
    exec_mode: "cluster",
    node_args: "--max-old-space-size=1024",
    env: {
      NODE_ENV: "production",
    }
  }]
}
