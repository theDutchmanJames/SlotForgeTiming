// SlotForge's unprivileged LPT helper. Uses an already running InpOut driver; never installs or starts one.
// The 8-bit IOCTL layout is documented in Highrez's MIT-licensed InpOut 1.5.0.1 source (see NOTICE.txt).
using System;
using System.Collections.Concurrent;
using System.Diagnostics;
using System.Globalization;
using System.Runtime.InteropServices;
using System.Threading;
using Microsoft.Win32.SafeHandles;

interface IPort : IDisposable { int Read(int address); void Write(int address, int value); }
sealed class DriverPort : IPort {
    [DllImport("kernel32.dll", CharSet = CharSet.Unicode, SetLastError = true)]
    static extern SafeFileHandle CreateFile(string name, uint access, uint share, IntPtr security, uint creation, uint flags, IntPtr template);
    [DllImport("kernel32.dll", SetLastError = true)]
    static extern bool DeviceIoControl(SafeFileHandle handle, uint code, byte[] input, int inputSize, byte[] output, int outputSize, out uint returned, IntPtr overlapped);
    readonly SafeFileHandle handle;
    public DriverPort() {
        handle = CreateFile(Environment.Is64BitOperatingSystem ? @"\\.\inpoutx64" : @"\\.\inpout32", 0xc0000000, 0, IntPtr.Zero, 3, 0x80, IntPtr.Zero);
        if (handle.IsInvalid) throw new InvalidOperationException("No accessible running InpOut driver. Install a compatible driver separately, or close another program using it. Windows error " + Marshal.GetLastWin32Error());
    }
    public int Read(int address) {
        var input = new byte[] { (byte)address, (byte)(address >> 8) }; var output = new byte[1]; uint returned;
        if (!DeviceIoControl(handle, unchecked((uint)-1673519100), input, 2, output, 1, out returned, IntPtr.Zero) || returned != 1) throw new InvalidOperationException("Port read failed. Windows error " + Marshal.GetLastWin32Error());
        return output[0];
    }
    public void Write(int address, int value) {
        var input = new byte[] { (byte)address, (byte)(address >> 8), (byte)value }; uint returned;
        if (!DeviceIoControl(handle, unchecked((uint)-1673519096), input, 3, null, 0, out returned, IntPtr.Zero)) throw new InvalidOperationException("Port write failed. Windows error " + Marshal.GetLastWin32Error());
    }
    public void Dispose() { handle.Dispose(); }
}
// Available only by an explicit command-line flag for automated tests. The production manager rejects it.
sealed class MemoryPort : IPort {
    public int Address = 0x378, Status = 0x80, Control = 0x0b, Data = 0;
    public int Read(int address) { return address == Address + 1 ? Status : address == Address + 2 ? Control : Data; }
    public void Write(int address, int value) { if (address == Address + 2) Control = value; else Data = value; }
    public void Dispose() { }
}
class Program {
    [UnmanagedFunctionPointer(CallingConvention.Winapi)] delegate void TimerCallback(uint id, uint message, UIntPtr user, UIntPtr a, UIntPtr b);
    [DllImport("winmm.dll")] static extern uint timeSetEvent(uint delay, uint resolution, TimerCallback callback, UIntPtr user, uint mode);
    [DllImport("winmm.dll")] static extern uint timeKillEvent(uint id);
    [DllImport("winmm.dll")] static extern uint timeBeginPeriod(uint period);
    [DllImport("winmm.dll")] static extern uint timeEndPeriod(uint period);
    static readonly CultureInfo Inv = CultureInfo.InvariantCulture;
    static readonly object Gate = new object();
    static readonly BlockingCollection<string> Queue = new BlockingCollection<string>(16384);
    static readonly TimerCallback TickCallback = Tick;
    static IPort Port; static bool Running, PeriodSet; static volatile bool Failed;
    static uint TimerId; static int Base, DataMask, ControlMask, DataOff, ControlOff, PrevStatus = -1, PrevControl = -1;
    static long Sequence; static double LastSample, LastSent, LastHeartbeat;
    static double Clock() { return Stopwatch.GetTimestamp() * (1000.0 / Stopwatch.Frequency); }
    static string Num(double n) { return n.ToString("F6", Inv); }
    static string Quote(string s) { return "\"" + s.Replace("\\", "\\\\").Replace("\"", "\\\"").Replace("\r", " ").Replace("\n", " ") + "\""; }
    static void Send(string s) { if (!Queue.TryAdd(s)) Failed = true; }
    static void Fail(Exception x) { Failed = true; Stop(); string discarded; while (Queue.TryTake(out discarded)) { } Send("{\"type\":\"error\",\"message\":" + Quote(x.Message) + "}"); }
    static void Off() {
        if (Port == null) return;
        if (DataMask != 0) Port.Write(Base, (Port.Read(Base) & ~DataMask) | (DataOff & DataMask));
        if (ControlMask != 0) Port.Write(Base + 2, (Port.Read(Base + 2) & ~ControlMask) | (ControlOff & ControlMask));
    }
    static void Stop() {
        Running = false;
        // Kill outside a callback without TIME_KILL_SYNCHRONOUS: Gate makes already pending ticks harmless.
        if (TimerId != 0) { timeKillEvent(TimerId); TimerId = 0; }
        try { Off(); } catch (Exception) { }
        if (PeriodSet) { timeEndPeriod(1); PeriodSet = false; }
    }
    static void Sample() {
        int control = Port.Read(Base + 2), status = Port.Read(Base + 1); double at = Clock();
        double gap = LastSample == 0 ? 0 : at - LastSample; LastSample = at;
        // Retain every transition, plus 20 ms heartbeats for held sensors and the measured polling gap.
        MaxGap = Math.Max(MaxGap, gap);
        if (status != PrevStatus || control != PrevControl || at - LastSent >= 20) {
            Send("{\"type\":\"sample\",\"seq\":" + (++Sequence) + ",\"at\":" + Num(at) + ",\"status\":" + status + ",\"control\":" + control + ",\"gap\":" + Num(MaxGap) + "}");
            PrevStatus = status; PrevControl = control; LastSent = at; MaxGap = 0;
        }
    }
    static double MaxGap;
    static void Tick(uint id, uint message, UIntPtr user, UIntPtr a, UIntPtr b) {
        lock (Gate) {
            if (!Running) return;
            try {
                if (Failed) throw new InvalidOperationException("Timing buffer overflow. Connection stopped; no samples were silently discarded.");
                if (Clock() - LastHeartbeat > 1800) throw new InvalidOperationException("App heartbeat lost. Assigned outputs were switched off.");
                Sample();
            } catch (Exception x) { Fail(x); }
        }
    }
    static int Integer(string[] p, int i, int min, int max) { int v; if (i >= p.Length || !int.TryParse(p[i], NumberStyles.Integer, Inv, out v) || v < min || v > max) throw new InvalidOperationException("Invalid helper command."); return v; }
    static void Command(string line) {
        var p = line.Split(' '); if (p.Length == 0) return;
        lock (Gate) {
            if (p[0] == "Q") { int id = Integer(p, 1, 0, 1000000); Send("{\"type\":\"clock\",\"id\":" + id + ",\"at\":" + Num(Clock()) + "}"); }
            else if (p[0] == "P") { LastHeartbeat = Clock(); }
            else if (p[0] == "CHECK") {
                int address = Integer(p, 1, 1, 65533); if (Port is MemoryPort) ((MemoryPort)Port).Address = address; int control = Port.Read(address + 2), status = Port.Read(address + 1);
                Send("{\"type\":\"checked\",\"status\":" + status + ",\"control\":" + control + "}"); // Read-only: no relay or control-line writes.
            }
            else if (p[0] == "START") {
                if (Running) throw new InvalidOperationException("Already connected.");
                Base = Integer(p, 1, 1, 65533); if (Port is MemoryPort) ((MemoryPort)Port).Address = Base; int interval = Integer(p, 2, 1, 10);
                DataMask = Integer(p, 3, 0, 255); ControlMask = Integer(p, 4, 0, 47); DataOff = Integer(p, 5, 0, 255); ControlOff = Integer(p, 6, 0, 47);
                Off(); Sequence = 0; PrevStatus = PrevControl = -1; LastSample = LastSent = MaxGap = 0; LastHeartbeat = Clock();
                PeriodSet = timeBeginPeriod(1) == 0; Running = true;
                Send("{\"type\":\"started\"}"); Sample();
                TimerId = timeSetEvent((uint)interval, 0, TickCallback, UIntPtr.Zero, 1);
                if (TimerId == 0) throw new InvalidOperationException("Windows could not start the polling timer.");
            }
            else if (p[0] == "O") {
                if (!Running || Failed) throw new InvalidOperationException("Not connected.");
                int data = Integer(p, 1, 0, 255), control = Integer(p, 2, 0, 47);
                if (DataMask != 0) Port.Write(Base, (Port.Read(Base) & ~DataMask) | (data & DataMask));
                if (ControlMask != 0) Port.Write(Base + 2, (Port.Read(Base + 2) & ~ControlMask) | (control & ControlMask));
            }
            else if (p[0] == "S" && Port is MemoryPort) { ((MemoryPort)Port).Status = Integer(p, 1, 0, 255); ((MemoryPort)Port).Control = Integer(p, 2, 0, 255); if (Running) Sample(); }
            else if (p[0] == "SNAP" && Port is MemoryPort) { var m = (MemoryPort)Port; Send("{\"type\":\"snapshot\",\"data\":" + m.Data + ",\"control\":" + m.Control + "}"); }
            else if (p[0] == "STOP") { Stop(); Send("{\"type\":\"stopped\"}"); }
            else throw new InvalidOperationException("Unknown helper command.");
        }
    }
    static int Main(string[] args) {
        Console.OutputEncoding = new System.Text.UTF8Encoding(false);
        var writer = new Thread(() => { try { foreach (var s in Queue.GetConsumingEnumerable()) Console.WriteLine(s); } catch { Failed = true; } }); writer.IsBackground = true; writer.Start();
        try {
            bool simulate = args.Length == 1 && args[0] == "--simulate";
            Port = simulate ? (IPort)new MemoryPort() : new DriverPort();
            Send("{\"type\":\"hello\",\"protocol\":1,\"simulation\":" + (simulate ? "true" : "false") + "}");
            string line; while ((line = Console.ReadLine()) != null) { if (line.Length > 256) throw new InvalidOperationException("Helper command too long."); Command(line); if (Failed) break; }
        } catch (Exception x) { lock (Gate) { Fail(x); } }
        finally { lock (Gate) { Stop(); if (Port != null) Port.Dispose(); } Queue.CompleteAdding(); writer.Join(1000); }
        return Failed ? 1 : 0;
    }
}
