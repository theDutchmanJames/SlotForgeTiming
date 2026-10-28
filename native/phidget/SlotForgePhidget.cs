// SlotForge-owned local USB bridge. Phidget22 ABI verified against the official Windows SDK.
// Timing is captured on the host callback thread, NOT on the Phidget hardware.
using System;
using System.Collections.Generic;
using System.Collections.Concurrent;
using System.Diagnostics;
using System.Globalization;
using System.IO;
using System.Runtime.InteropServices;
using System.Threading;
using System.Web.Script.Serialization;

static class Native {
    const string Lib="phidget22.dll";
    [UnmanagedFunctionPointer(CallingConvention.StdCall)] public delegate void State(IntPtr h,IntPtr ctx,int value);
    [UnmanagedFunctionPointer(CallingConvention.StdCall)] public delegate void Value(IntPtr h,IntPtr ctx,double value);
    [UnmanagedFunctionPointer(CallingConvention.StdCall)] public delegate void Detach(IntPtr h,IntPtr ctx);
    [UnmanagedFunctionPointer(CallingConvention.StdCall)] public delegate void Error(IntPtr h,IntPtr ctx,int code,IntPtr text);
    [UnmanagedFunctionPointer(CallingConvention.StdCall)] public delegate void Found(IntPtr manager,IntPtr ctx,IntPtr channel);
    [DllImport("kernel32.dll",CharSet=CharSet.Unicode,SetLastError=true)] public static extern IntPtr LoadLibraryEx(string path,IntPtr file,uint flags);
    [DllImport(Lib,CallingConvention=CallingConvention.StdCall)] public static extern int Phidget_getErrorDescription(int code,out IntPtr text);
    [DllImport(Lib,CallingConvention=CallingConvention.StdCall)] public static extern int Phidget_getDeviceClass(IntPtr h,out int value);
    [DllImport(Lib,CallingConvention=CallingConvention.StdCall)] public static extern int Phidget_getChannelClass(IntPtr h,out int value);
    [DllImport(Lib,CallingConvention=CallingConvention.StdCall)] public static extern int Phidget_getDeviceName(IntPtr h,out IntPtr value);
    [DllImport(Lib,CallingConvention=CallingConvention.StdCall)] public static extern int Phidget_getDeviceVersion(IntPtr h,out int value);
    [DllImport(Lib,CallingConvention=CallingConvention.StdCall)] public static extern int Phidget_getDeviceSerialNumber(IntPtr h,out int value);
    [DllImport(Lib,CallingConvention=CallingConvention.StdCall)] public static extern int Phidget_getChannel(IntPtr h,out int value);
    [DllImport(Lib,CallingConvention=CallingConvention.StdCall)] public static extern int Phidget_getHubPort(IntPtr h,out int value);
    [DllImport(Lib,CallingConvention=CallingConvention.StdCall)] public static extern int Phidget_getIsHubPortDevice(IntPtr h,out int value);
    [DllImport(Lib,CallingConvention=CallingConvention.StdCall)] public static extern int Phidget_setDeviceSerialNumber(IntPtr h,int value);
    [DllImport(Lib,CallingConvention=CallingConvention.StdCall)] public static extern int Phidget_setChannel(IntPtr h,int value);
    [DllImport(Lib,CallingConvention=CallingConvention.StdCall)] public static extern int Phidget_setHubPort(IntPtr h,int value);
    [DllImport(Lib,CallingConvention=CallingConvention.StdCall)] public static extern int Phidget_setIsHubPortDevice(IntPtr h,int value);
    [DllImport(Lib,CallingConvention=CallingConvention.StdCall)] public static extern int Phidget_setIsLocal(IntPtr h,int value);
    [DllImport(Lib,CallingConvention=CallingConvention.StdCall)] public static extern int Phidget_openWaitForAttachment(IntPtr h,uint timeout);
    [DllImport(Lib,CallingConvention=CallingConvention.StdCall)] public static extern int Phidget_close(IntPtr h);
    [DllImport(Lib,CallingConvention=CallingConvention.StdCall)] public static extern int Phidget_delete(ref IntPtr h);
    [DllImport(Lib,CallingConvention=CallingConvention.StdCall)] public static extern int Phidget_setOnDetachHandler(IntPtr h,Detach handler,IntPtr ctx);
    [DllImport(Lib,CallingConvention=CallingConvention.StdCall)] public static extern int Phidget_setOnErrorHandler(IntPtr h,Error handler,IntPtr ctx);
    [DllImport(Lib,CallingConvention=CallingConvention.StdCall)] public static extern int PhidgetManager_create(out IntPtr h);
    [DllImport(Lib,CallingConvention=CallingConvention.StdCall)] public static extern int PhidgetManager_open(IntPtr h);
    [DllImport(Lib,CallingConvention=CallingConvention.StdCall)] public static extern int PhidgetManager_close(IntPtr h);
    [DllImport(Lib,CallingConvention=CallingConvention.StdCall)] public static extern int PhidgetManager_delete(ref IntPtr h);
    [DllImport(Lib,CallingConvention=CallingConvention.StdCall)] public static extern int PhidgetManager_setOnAttachHandler(IntPtr h,Found handler,IntPtr ctx);
    [DllImport(Lib,CallingConvention=CallingConvention.StdCall)] public static extern int PhidgetDigitalInput_create(out IntPtr h);
    [DllImport(Lib,CallingConvention=CallingConvention.StdCall)] public static extern int PhidgetDigitalInput_setOnStateChangeHandler(IntPtr h,State handler,IntPtr ctx);
    [DllImport(Lib,CallingConvention=CallingConvention.StdCall)] public static extern int PhidgetVoltageInput_create(out IntPtr h);
    [DllImport(Lib,CallingConvention=CallingConvention.StdCall)] public static extern int PhidgetVoltageInput_setOnVoltageChangeHandler(IntPtr h,Value handler,IntPtr ctx);
    [DllImport(Lib,CallingConvention=CallingConvention.StdCall)] public static extern int PhidgetVoltageInput_getMinDataInterval(IntPtr h,out uint value);
    [DllImport(Lib,CallingConvention=CallingConvention.StdCall)] public static extern int PhidgetVoltageInput_setDataInterval(IntPtr h,uint value);
    [DllImport(Lib,CallingConvention=CallingConvention.StdCall)] public static extern int PhidgetVoltageInput_setVoltageChangeTrigger(IntPtr h,double value);
    [DllImport(Lib,CallingConvention=CallingConvention.StdCall)] public static extern int PhidgetVoltageRatioInput_create(out IntPtr h);
    [DllImport(Lib,CallingConvention=CallingConvention.StdCall)] public static extern int PhidgetVoltageRatioInput_setOnVoltageRatioChangeHandler(IntPtr h,Value handler,IntPtr ctx);
    [DllImport(Lib,CallingConvention=CallingConvention.StdCall)] public static extern int PhidgetVoltageRatioInput_getMinDataInterval(IntPtr h,out uint value);
    [DllImport(Lib,CallingConvention=CallingConvention.StdCall)] public static extern int PhidgetVoltageRatioInput_setDataInterval(IntPtr h,uint value);
    [DllImport(Lib,CallingConvention=CallingConvention.StdCall)] public static extern int PhidgetVoltageRatioInput_setVoltageRatioChangeTrigger(IntPtr h,double value);
    [DllImport(Lib,CallingConvention=CallingConvention.StdCall)] public static extern int PhidgetDigitalOutput_create(out IntPtr h);
    [DllImport(Lib,CallingConvention=CallingConvention.StdCall)] public static extern int PhidgetDigitalOutput_setState(IntPtr h,int value);
    [DllImport(Lib,CallingConvention=CallingConvention.StdCall)] public static extern int PhidgetDigitalOutput_getMinFailsafeTime(IntPtr h,out uint value);
    [DllImport(Lib,CallingConvention=CallingConvention.StdCall)] public static extern int PhidgetDigitalOutput_getMaxFailsafeTime(IntPtr h,out uint value);
    [DllImport(Lib,CallingConvention=CallingConvention.StdCall)] public static extern int PhidgetDigitalOutput_enableFailsafe(IntPtr h,uint value);
    [DllImport(Lib,CallingConvention=CallingConvention.StdCall)] public static extern int PhidgetDigitalOutput_resetFailsafe(IntPtr h);
}
class Channel { public IntPtr H; public string Key; public int Off; public bool Failsafe,Output; public volatile bool Seen; public Native.State State; public Native.Value Value; public Native.Detach Detach; public Native.Error Error; }
class Program {
    static readonly JavaScriptSerializer Json=new JavaScriptSerializer(), CommandJson=new JavaScriptSerializer();
    static readonly ConcurrentQueue<string> Queue=new ConcurrentQueue<string>(),Commands=new ConcurrentQueue<string>();
    static readonly object EmitLock=new object(); static readonly List<Channel> Channels=new List<Channel>();
    static volatile bool Quit,Connected,Closing; static volatile string Fault; static bool Simulation,Loaded; static string TestLibrary;
    static int Seq; static long Ping=Stopwatch.GetTimestamp(); static IntPtr Library;
    static double Now(){return Stopwatch.GetTimestamp()*1000.0/Stopwatch.Frequency;}
    static void Emit(object value){lock(EmitLock){if(Queue.Count>16384){Fault="Input event queue overflow.";return;}Queue.Enqueue(Json.Serialize(value));}}
    static void Sample(Channel ch,double value){lock(EmitLock){ch.Seen=true;Emit(new {type="sample",key=ch.Key,value=value,at=Now(),seq=++Seq});}}
    static void Check(int code){if(code==0)return;IntPtr p;Native.Phidget_getErrorDescription(code,out p);throw new InvalidOperationException("Phidget22 ("+code+"): "+Marshal.PtrToStringAnsi(p));}
    static void Load(){if(Simulation||Loaded)return;string dll=TestLibrary??Path.Combine(Environment.GetFolderPath(Environment.SpecialFolder.ProgramFiles),"Phidgets","Phidget22","phidget22.dll");if(!File.Exists(dll))throw new InvalidOperationException("Install the 64-bit Phidget22 libraries from phidgets.com, then restart SlotForge. Expected: "+dll);Library=Native.LoadLibraryEx(dll,IntPtr.Zero,0x00000100|0x00001000);if(Library==IntPtr.Zero)throw new InvalidOperationException("Cannot load the 64-bit Phidget22 library. Windows error "+Marshal.GetLastWin32Error());Loaded=true;}
    static Dictionary<string,object> Obj(object o){return (Dictionary<string,object>)o;}
    static int Int(Dictionary<string,object> o,string k){return Convert.ToInt32(o[k],CultureInfo.InvariantCulture);}
    static void CloseAll(){Closing=true;Connected=false;foreach(var c in Channels){if(!Simulation&&c.H!=IntPtr.Zero){if(c.Output)Native.PhidgetDigitalOutput_setState(c.H,c.Off);Native.Phidget_close(c.H);Native.Phidget_delete(ref c.H);}}Channels.Clear();Closing=false;}
    static object Scan(){Load();if(Simulation)return new object[0];var found=new Dictionary<string,object>();IntPtr manager;Check(Native.PhidgetManager_create(out manager));Native.Found handler=(m,ctx,h)=>{try{IntPtr name;int cls,deviceClass,serial,index,hub=-1,hubDevice=0,version=0;Check(Native.Phidget_getChannelClass(h,out cls));string type=cls==5?"digital":cls==6?"output":cls==29?"voltage":cls==31?"ratio":null;if(type==null)return;Check(Native.Phidget_getDeviceSerialNumber(h,out serial));Check(Native.Phidget_getChannel(h,out index));if(Native.Phidget_getHubPort(h,out hub)!=0)hub=-1;if(Native.Phidget_getIsHubPortDevice(h,out hubDevice)!=0)hubDevice=0;Check(Native.Phidget_getDeviceClass(h,out deviceClass));if(deviceClass!=0x15&&hubDevice==0)hub=-1;Native.Phidget_getDeviceVersion(h,out version);Check(Native.Phidget_getDeviceName(h,out name));var a=new {serial=serial,channel=index,hubPort=hub,hubDevice=hubDevice!=0,type=type};lock(found)found[serial+":"+hub+":"+hubDevice+":"+type+":"+index]=new{address=a,name=Marshal.PtrToStringAnsi(name),version=version};}catch(Exception e){Fault=e.Message;}};
        try{Check(Native.PhidgetManager_setOnAttachHandler(manager,handler,IntPtr.Zero));Check(Native.PhidgetManager_open(manager));Thread.Sleep(1200);if(Fault!=null)throw new InvalidOperationException(Fault);lock(found)return new List<object>(found.Values).ToArray();}finally{Native.PhidgetManager_close(manager);Native.PhidgetManager_delete(ref manager);GC.KeepAlive(handler);}}
    static void Open(object[] list){Load();CloseAll();Seq=0;Fault=null;if(list.Length<1||list.Length>64)throw new InvalidOperationException("Invalid channel count.");var seen=new HashSet<string>();
        foreach(object item in list){var d=Obj(item);var a=Obj(d["address"]);string type=(string)a["type"],key=(string)d["key"];int serial=Int(a,"serial"),index=Int(a,"channel"),hub=Int(a,"hubPort");bool hubDevice=(bool)a["hubDevice"];if(serial<1||index<0||index>127||hub < -1||hub>63||!seen.Add(key))throw new InvalidOperationException("Invalid channel address.");var c=new Channel{Key=key,Output=type=="output",Off=Int(d,"off")};Channels.Add(c);
            if(Simulation){if(!c.Output)Sample(c,Convert.ToDouble(d["initial"],CultureInfo.InvariantCulture));continue;}
            if(type=="digital")Check(Native.PhidgetDigitalInput_create(out c.H));else if(type=="voltage")Check(Native.PhidgetVoltageInput_create(out c.H));else if(type=="ratio")Check(Native.PhidgetVoltageRatioInput_create(out c.H));else if(type=="output")Check(Native.PhidgetDigitalOutput_create(out c.H));else throw new InvalidOperationException("Unsupported channel type.");
            Check(Native.Phidget_setIsLocal(c.H,1));Check(Native.Phidget_setDeviceSerialNumber(c.H,serial));Check(Native.Phidget_setChannel(c.H,index));if(hub>=0){Check(Native.Phidget_setHubPort(c.H,hub));Check(Native.Phidget_setIsHubPortDevice(c.H,hubDevice?1:0));}
            c.Detach=(h,ctx)=>{if(!Closing)Fault="A configured Phidget channel disconnected. Reconnect and restart manually.";};c.Error=(h,ctx,code,text)=>{if(!Closing)Fault="Phidget channel error "+code+": "+Marshal.PtrToStringAnsi(text);};Check(Native.Phidget_setOnDetachHandler(c.H,c.Detach,IntPtr.Zero));Check(Native.Phidget_setOnErrorHandler(c.H,c.Error,IntPtr.Zero));
            c.State=(h,ctx,v)=>{try{Sample(c,v);}catch(Exception e){Fault=e.Message;}};c.Value=(h,ctx,v)=>{try{Sample(c,v);}catch(Exception e){Fault=e.Message;}};
            if(type=="digital")Check(Native.PhidgetDigitalInput_setOnStateChangeHandler(c.H,c.State,IntPtr.Zero));else if(type=="voltage")Check(Native.PhidgetVoltageInput_setOnVoltageChangeHandler(c.H,c.Value,IntPtr.Zero));else if(type=="ratio")Check(Native.PhidgetVoltageRatioInput_setOnVoltageRatioChangeHandler(c.H,c.Value,IntPtr.Zero));
            Check(Native.Phidget_openWaitForAttachment(c.H,2000));
            if(c.Output){Check(Native.PhidgetDigitalOutput_setState(c.H,c.Off));}
            else if(type=="voltage"){uint min;Check(Native.PhidgetVoltageInput_getMinDataInterval(c.H,out min));Check(Native.PhidgetVoltageInput_setDataInterval(c.H,min));Check(Native.PhidgetVoltageInput_setVoltageChangeTrigger(c.H,0));}
            else if(type=="ratio"){uint min;Check(Native.PhidgetVoltageRatioInput_getMinDataInterval(c.H,out min));Check(Native.PhidgetVoltageRatioInput_setDataInterval(c.H,min));Check(Native.PhidgetVoltageRatioInput_setVoltageRatioChangeTrigger(c.H,0));}
        }
        // Initial state events establish clear/covered levels. Never manufacture a crossing at open.
        double until=Now()+2500;while(Now()<until&&Channels.Exists(c=>!c.Output&&!c.Seen)&&Fault==null)Thread.Sleep(5);if(Fault!=null)throw new InvalidOperationException(Fault);if(Channels.Exists(c=>!c.Output&&!c.Seen))throw new InvalidOperationException("No initial sensor state received.");// Arm failsafes only after every channel is ready; sequential attachment can take seconds.
        if(!Simulation)foreach(var c in Channels)if(c.Output){uint min,max;int rc=Native.PhidgetDigitalOutput_getMinFailsafeTime(c.H,out min);if(rc==0){Check(Native.PhidgetDigitalOutput_getMaxFailsafeTime(c.H,out max));Check(Native.PhidgetDigitalOutput_enableFailsafe(c.H,Math.Max(min,Math.Min(max,2000))));c.Failsafe=true;}else if(rc!=0x14)Check(rc);}
        Connected=true;Ping=Stopwatch.GetTimestamp();
    }
    static void Command(Dictionary<string,object> d){int id=Int(d,"id");string cmd=(string)d["cmd"];try{
        if(cmd=="clock"){Emit(new{type="reply",id=id,at=Now()});return;}
        if(cmd=="scan"){Emit(new{type="reply",id=id,devices=Scan()});return;}
        if(cmd=="open"){Open(((System.Collections.ArrayList)d["channels"]).ToArray());Emit(new{type="reply",id=id,failsafes=Channels.FindAll(c=>c.Failsafe).ConvertAll(c=>c.Key).ToArray()});return;}
        if(cmd=="close"){CloseAll();Emit(new{type="reply",id=id});return;}
        if(cmd=="ping"){Ping=Stopwatch.GetTimestamp();foreach(var c in Channels)if(c.Failsafe)Check(Native.PhidgetDigitalOutput_resetFailsafe(c.H));Emit(new{type="reply",id=id});return;}
        if(cmd=="outputs"){if(!Connected)throw new InvalidOperationException("Not connected.");foreach(var pair in Obj(d["values"])){var c=Channels.Find(x=>x.Key==pair.Key&&x.Output);int value=Convert.ToInt32(pair.Value);if(c==null||(value!=0&&value!=1))throw new InvalidOperationException("Unassigned output.");if(!Simulation)Check(Native.PhidgetDigitalOutput_setState(c.H,value));}Emit(new{type="reply",id=id});return;}
        if(cmd=="inject"&&Simulation){var c=Channels.Find(x=>x.Key==(string)d["key"]&&!x.Output);if(c==null)throw new InvalidOperationException("Unknown simulated channel.");Sample(c,Convert.ToDouble(d["value"]));Emit(new{type="reply",id=id});return;}
        throw new InvalidOperationException("Unknown helper command.");
    }catch(Exception e){CloseAll();Emit(new{type="error",id=id,message=e.Message});}}
    static int Main(string[] args){Simulation=Array.IndexOf(args,"--simulate")>=0;int lib=Array.IndexOf(args,"--library");if(lib>=0&&lib+1<args.Length)TestLibrary=Path.GetFullPath(args[lib+1]);
        var writer=new Thread(()=>{while(!Quit||!Queue.IsEmpty){string s;if(Queue.TryDequeue(out s)){try{Console.Out.WriteLine(s);Console.Out.Flush();}catch{Quit=true;}}else Thread.Sleep(1);}});writer.IsBackground=true;writer.Start();
        new Thread(()=>{string line;while((line=Console.ReadLine())!=null){if(line.Length>131072){Fault="Command too large.";break;}Commands.Enqueue(line);}Quit=true;}){IsBackground=true}.Start();
        Emit(new{type="hello",protocol=1,simulation=Simulation});double next=0;
        try{while(!Quit){string line;while(Commands.TryDequeue(out line)){try{Command(CommandJson.Deserialize<Dictionary<string,object>>(line));}catch(Exception e){Fault=e.Message;}}if(Connected&&Now()-Ping*1000.0/Stopwatch.Frequency>2200)Fault="SlotForge heartbeat lost; outputs released.";if(Fault!=null){CloseAll();Emit(new{type="error",message=Fault});break;}if(Connected&&Now()>=next){lock(EmitLock)Emit(new{type="tick",at=Now(),seq=++Seq});next=Now()+20;}Thread.Sleep(2);}}finally{CloseAll();Quit=true;writer.Join(1000);}return Fault==null?0:1;
    }
}
