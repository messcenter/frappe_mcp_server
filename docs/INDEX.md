# Frappe MCP Server Documentation

Welcome to the Frappe MCP Server documentation. This folder contains all technical documentation for the project.

## Documentation Structure

### Setup & Configuration
- [CLAUDE_CODE_SETUP.md](./CLAUDE_CODE_SETUP.md) - Setting up the server for Claude Code
- [test-config.example.env](./test-config.example.env) - Example test configuration

### Technical Documentation
- [ARCHITECTURE.md](./ARCHITECTURE.md) - System architecture and design
- [HTTP_API.md](./HTTP_API.md) - HTTP API reference and examples
- [TESTING.md](./TESTING.md) - Testing guide and strategies

### Development Notes
- [REFACTORING.md](./REFACTORING.md) - Refactoring notes and improvements
- [custom_app_introspection.md](./custom_app_introspection.md) - App introspection design
- [static_hints_design.md](./static_hints_design.md) - Static hints system design
- [usage_info_enhancement.md](./usage_info_enhancement.md) - Usage info enhancements

### Historical Development
- CLAUDE.md - Original development notes (if present)

## Quick Links

- **Main README**: [../README.md](../README.md)
- **Source Code**: [../src/](../src/)
- **Tests**: [../test-*.js](../)

## Key Concepts

### Model Context Protocol (MCP)
The server implements the MCP protocol to enable AI assistants to interact with Frappe/ERPNext systems.

### Transport Mechanisms
- **stdio**: For local tools like Claude Desktop
- **HTTP**: For web-based access on port 51966 (0xCAFE)

### Tool Categories
1. **Document Operations**: CRUD operations on Frappe documents
2. **Schema Operations**: DocType schema and metadata
3. **Helper Tools**: Utilities for exploration and discovery

## Getting Started

1. Read [ARCHITECTURE.md](./ARCHITECTURE.md) for system overview
2. Follow [CLAUDE_CODE_SETUP.md](./CLAUDE_CODE_SETUP.md) for setup
3. Refer to [HTTP_API.md](./HTTP_API.md) for API usage
4. Use [TESTING.md](./TESTING.md) for testing guidance