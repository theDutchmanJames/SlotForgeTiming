# SlotForge Parallel Port helper

`SlotForgeParallel.exe` is built from `SlotForgeParallel.cs` using `npm run parallel:build` on Windows. It targets .NET Framework 4.x, AnyCPU, without third-party managed packages. The release includes the executable and source. Electron Builder unpacks the executable from ASAR before execution.

Production starts the helper with no arguments. It opens an already running InpOut driver using the documented 8-bit protocol. There is no driver/DLL installer, service-start code, automatic elevation or security-setting modification. `--simulate` uses in-memory ports for automated tests; the production main-process controller rejects a simulation handshake.

The line protocol contains HELLO, clock synchronization, read-only CHECK, START with validated address/output ownership masks, heartbeat, masked output state, and STOP. Samples include native timestamps and monotonic sequence numbers. EOF and watchdog expiry return assigned outputs inactive where the driver remains writable. See `../../docs/PARALLEL-PORT.md` for details and validation limits.

The InpOut interface constants and packet layout were verified against Highrez's official `Inpout32_dll_source_1501.zip`: https://vps.highrez.co.uk/downloads/InpOut32/default.htm. `NOTICE-InpOut.txt` preserves its MIT notice. No InpOut executable, DLL or kernel driver is redistributed.
