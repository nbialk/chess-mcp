# Changelog

## [0.4.0](https://github.com/nbialk/chess-mcp/compare/v0.3.1...v0.4.0) (2026-06-13)


### Features

* **puzzle:** add interactive get-daily-puzzle tool ([cab60a3](https://github.com/nbialk/chess-mcp/commit/cab60a3c58752820a335ca77928bc57d278e1470))


### Documentation

* **readme:** restructure with contents, table, and repo links ([bf6cfbc](https://github.com/nbialk/chess-mcp/commit/bf6cfbced9063ceb0f00f9dd5c5fc9bd3311879f))

## [0.3.1](https://github.com/nbialk/chess-mcp/compare/v0.3.0...v0.3.1) (2026-06-13)


### Bug Fixes

* **server:** add fetch timeouts, URL-encode usernames, soften not-found results ([ff1e571](https://github.com/nbialk/chess-mcp/commit/ff1e5712799f3be341f03e8db5676b453d3973fe))


### Performance Improvements

* **server:** move board replay positions to _meta to cut model context ([2da24a0](https://github.com/nbialk/chess-mcp/commit/2da24a06658e5f7ebdf7207af37c942bc69106ef))


### Code Refactoring

* **server:** extract typed chess.com client with zod boundary ([1e8bd2d](https://github.com/nbialk/chess-mcp/commit/1e8bd2d29af0b2d5d4c54d42ba90589f5d35e26c))


### Documentation

* **agents:** replace missing-skill instruction with accurate repo guide ([f307ac8](https://github.com/nbialk/chess-mcp/commit/f307ac8a7ca892fc02ce65a3e2ef8ae8edea879f))
* **plans:** add improvement implementation plans ([3b4b24f](https://github.com/nbialk/chess-mcp/commit/3b4b24f233d48adea96d4ae31ba7ca2c88dec0c5))
* **plans:** mark improvement plans as done ([8d040d0](https://github.com/nbialk/chess-mcp/commit/8d040d0a06dd1f088eef38c9ff61335c6c36ef92))

## [0.3.0](https://github.com/nbialk/chess-mcp/compare/v0.2.1...v0.3.0) (2026-06-04)


### Features

* **analytics:** track all MCP methods and client identity ([cabe0fa](https://github.com/nbialk/chess-mcp/commit/cabe0fae9fdf939c9d456b5f17ddc6255f03cedf))


### Documentation

* **readme:** point badge to live demo; add agent shim sync script ([c9d3cc1](https://github.com/nbialk/chess-mcp/commit/c9d3cc1c49aea61bf33c8c2cebeec57620d19478))

## [0.2.0](https://github.com/nbialk/chess-mcp/compare/v0.1.0...v0.2.0) (2026-06-04)


### Features

* **server:** serve favicon for MCP clients ([b5a67ac](https://github.com/nbialk/chess-mcp/commit/b5a67ac21b847c65db95bdaac765e2a211bd1d50))


### Bug Fixes

* **server:** report version from APP_VERSION env ([66e8699](https://github.com/nbialk/chess-mcp/commit/66e869962f5330b8234e025a3ee7e71423f82fef))


### Documentation

* **readme:** update domain to mcp.chess.niklas.sh ([2e8bf39](https://github.com/nbialk/chess-mcp/commit/2e8bf39d423cd0010cdcf1a35b21cec4e4d10cc4))

## [0.1.0](https://github.com/nbialk/chess-mcp/compare/chess-mcp-v0.1.0...chess-mcp-v0.1.0) (2026-06-04)


### Features

* **deploy:** migrate to Cloud Run with PostHog analytics and SemVer releases ([c797535](https://github.com/nbialk/chess-mcp/commit/c797535d3afec3f86b1c1fcc39a468fb48dec7a0))
