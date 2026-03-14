# RISK Game Project

Read `risk-game-spec.md` for the full technical specification.
Follow the implementation phases defined in section 11.
Use TypeScript for both client and server.
Use the file/folder structure defined in section 12.

## Conventions
- All game logic is server-authoritative
- Validate every client action server-side before applying
- Use Zod for runtime validation of socket messages
- Keep the shared types in shared/types.ts

## Testing Requirements
- Use Vitest for all tests (shared config for client and server)
- Every pure game logic function must have unit tests BEFORE the function is considered done
- Use a seeded RNG wrapper for all randomness so tests are deterministic
- Validation functions need both positive and negative test cases
- Integration tests simulate real Socket.IO connections with multiple clients
- Target: game engine and validation should have >95% branch coverage
- Never mock core game logic in tests — mock only I/O boundaries (DB, sockets)
