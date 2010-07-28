/*
* Daemon.node
*** A node.JS addon that allows creating Unix/Linux Daemons in pure Javascript.
*** Copyright 2010 (c) <arthur@norgic.com>
* Under MIT License. See LICENSE file.
*/

#include <node/node.h>
#include <v8.h>
#include <unistd.h>
#include <stdlib.h>
#include <sys/stat.h>
#include <fcntl.h>
#include <string.h>

#define PID_MAXLEN 10

using namespace v8;

// Go through special routines to become a daemon.
// if successful, returns daemon's PID
Handle<Value> Start(const Arguments& args) {
	pid_t pid;
	
	pid = fork();
	if(pid > 0) exit(0);
	if(pid < 0) exit(1);
	
	// Can be changed after with process.umaks
	umask(0);
	
	setsid();
	
	// Can be changed with process.chdir
	chdir("/");
	
	return Integer::New(getpid());
}

// Close Standard IN/OUT/ERR Streams
Handle<Value> CloseIO(const Arguments& args) {
	close(STDIN_FILENO);
	close(STDOUT_FILENO);
	close(STDERR_FILENO);
}

// File-lock to make sure that only one instance of daemon is running.. also for storing PID
/* lock ( filename )
*** filename: a path to a lock-file.
*** Note: if filename doesn't exist, it will be created when function is called.
*/
Handle<Value> LockD(const Arguments& args) {
	if(!args[0]->IsString())
		return Boolean::New(false);
	
	String::Utf8Value data(args[0]->ToString());
	char pid_str[PID_MAXLEN+1];
	
	int lfp = open(*data, O_RDWR | O_CREAT, 0640);
	if(lfp < 0) exit(1);
	if(lockf(lfp, F_TLOCK, 0) < 0) exit(0);
	
	int len = snprintf(pid_str, PID_MAXLEN, "%d", getpid());
	write(lfp, pid_str, len);
	
	return Boolean::New(true);
}

class StreamPtr : public node::ObjectWrap
{
public:
    explicit StreamPtr(FILE** fpp, const char *pmode);
    ~StreamPtr();

    static Handle<Value> Open(const Arguments& args);
    static Handle<Value> Close(const Arguments& args);
    static Handle<Value> Redirect(const Arguments& args);

    static void Initialize(Handle<Object> target);
    static Handle<Value> New(const Arguments& args);

    FILE** stream;
    const char *mode;
private:
    static Persistent<FunctionTemplate> constructor_template;
};

Persistent<FunctionTemplate> StreamPtr::constructor_template;

StreamPtr::StreamPtr(FILE** fpp, const char *pmode)
    : stream(fpp)
    , mode( pmode )
{
}

StreamPtr::~StreamPtr()
{
    fclose(*stream);
}

Handle<Value> StreamPtr::Open(const Arguments& args)
{
    HandleScope scope;

    StreamPtr *fp = ObjectWrap::Unwrap<StreamPtr>(args.This());
    char *new_file = *String::Utf8Value(args[0]->ToString());
    *fp->stream = fopen(new_file, fp->mode);

    // return if the creation of the new FILE* was successful;
    return Boolean::New( *fp->stream != NULL );
}

Handle<Value> StreamPtr::Close(const Arguments& args)
{
    HandleScope handle_scope;

    StreamPtr *fp = ObjectWrap::Unwrap<StreamPtr>(args.This());
    assert( fp && "object had no InternalField" );
    int ret = fclose(*fp->stream);

    return Boolean::New(ret == 0);
}

Handle<Value> StreamPtr::Redirect(const Arguments& args)
{
    HandleScope scope;
    if (Close(args)->ToBoolean()->Value())
    {
        return Open(args);
    } else {
        return Boolean::New(false);
    }
}

Persistent<Object> stdin_obj;
Persistent<Object> stdout_obj;
Persistent<Object> stderr_obj;

void StreamPtr::Initialize(Handle<Object> target)
{
    HandleScope scope;

    Local<FunctionTemplate> file_pointer = FunctionTemplate::New(StreamPtr::New);
    constructor_template = Persistent<FunctionTemplate>::New(file_pointer);
    constructor_template->InstanceTemplate()->SetInternalFieldCount(1);

    NODE_SET_PROTOTYPE_METHOD(constructor_template, "open", StreamPtr::Open);
    NODE_SET_PROTOTYPE_METHOD(constructor_template, "close", StreamPtr::Close);
    NODE_SET_PROTOTYPE_METHOD(constructor_template, "sendTo", StreamPtr::Redirect);

    // Although we could expose the prototype directly, I see no reason to, as it's not
    // very useful for anything other than the intended purpose.
    //target->Set(String::NewSymbol("StreamPtr"), constructor_template->GetFunction());

    stdin_obj = Persistent<Object>::New( constructor_template->GetFunction()->NewInstance() );
    Handle<External> stdin_ptr = External::New( new StreamPtr( &stdin, "r" ) );
    stdin_obj->SetInternalField(0, stdin_ptr);
    target->Set(String::NewSymbol("stdin"), stdin_obj);

    stdout_obj = Persistent<Object>::New( constructor_template->GetFunction()->NewInstance() );
    Handle<External> stdout_ptr = External::New( new StreamPtr( &stdout, "w" ) );
    stdout_obj->SetInternalField(0, stdout_ptr);
    target->Set(String::NewSymbol("stdout"), stdout_obj);

    stderr_obj = Persistent<Object>::New( constructor_template->GetFunction()->NewInstance() );
    Handle<External> stderr_ptr = External::New( new StreamPtr( &stderr, "w" ) );
    stderr_obj->SetInternalField(0, stderr_ptr);
    target->Set(String::NewSymbol("stderr"), stderr_obj);
}

Handle<Value> StreamPtr::New(const Arguments& args)
{
    HandleScope scope;
    return scope.Close(args.This());
}

/* The default object:
 * {
 *     "fork":   true,
 *     "lock":   "daemon.pid"
 *     "stdout": null,
 *     "stderr": null,
 *     "stdin":  null,
 *     "umask":  0,
 *     "chroot": null,
 *     "chdir":  ".",
 * }
 */

#define SET_DEFAULT(obj, name, value) \
do { \
Local<String> str_##name = String::New(#name); \
if( !obj->Has( str_##name ) ) \
    obj->Set( str_##name, (value) ); \
} while (0)

static inline void setDefaults(Handle<Object> &arg)
{
    HandleScope scope;

    SET_DEFAULT( arg, fork, Boolean::New(true) );
    SET_DEFAULT( arg, lock, String::New("daemon.pid") );
    SET_DEFAULT( arg, stdin, Null() );
    SET_DEFAULT( arg, stdout, Null() );
    SET_DEFAULT( arg, stderr, Null() );
    SET_DEFAULT( arg, umask, Integer::New(0) );
    SET_DEFAULT( arg, chroot, Null() );
    SET_DEFAULT( arg, chdir, String::New(".") );
    //SET_DEFAULT( arg, close_fds, Boolean::New(false) );
    //SET_DEFAULT( arg, catch_signals, Boolean::New(false) );
}

#undef SET_DEFAULT

Handle<Value> Init(const Arguments& args) 
{
    HandleScope scope;

    Local<Object> arg = args[0]->ToObject();
    setDefaults( arg );

    pid_t pid = 0;
    if( arg->Get( String::New("fork") )->IsTrue() )
    {
        pid = fork();
	if(pid > 0) exit(0);
	if(pid < 0) exit(1);
    }

    if( !arg->Get( String::New("lock") )->IsNull() )
    {
        Local<String> file = arg->Get( String::New( "lock" ) )->ToString();
        String::Utf8Value data(file);
        char pid_str[PID_MAXLEN+1];

        int lfp = open(*data, O_RDWR | O_CREAT, 0640);
        if(lfp < 0) exit(1);
        if(lockf(lfp, F_TLOCK, 0) < 0) exit(0);

        int len = snprintf(pid_str, PID_MAXLEN, "%d", getpid());
        write(lfp, pid_str, len);
    }

    if( arg->Get( String::New("stdin") )->IsNull() )
    {
        Local<Function> close = Function::Cast( *stdin_obj->Get( String::New("close") ) );
        close->Call( stdin_obj, 0, NULL );
    } else {
        Local<Function> send_to = Function::Cast( *stdin_obj->Get( String::New("sendTo") ) );
        Local<Value> string_arg = arg->Get( String::New("stdin") );
        send_to->Call( stdin_obj, 1, &string_arg );
    }

    if( arg->Get( String::New("stdout") )->IsNull() )
    {
        Local<Function> close = Function::Cast( *stdout_obj->Get( String::New("close") ) );
        close->Call( stdout_obj, 0, NULL );
    } else {
        Local<Function> send_to = Function::Cast( *stdout_obj->Get( String::New("sendTo") ) );
        Local<Value> string_arg = arg->Get( String::New("stdout") );
        send_to->Call( stdout_obj, 1, &string_arg );
    }

    if( arg->Get( String::New("stderr") )->IsNull() )
    {
        Local<Function> close = Function::Cast( *stderr_obj->Get( String::New("close") ) );
        close->Call( stderr_obj, 0, NULL );
    } else {
        Local<Function> send_to = Function::Cast( *stderr_obj->Get( String::New("sendTo") ) );
        Local<Value> string_arg = arg->Get( String::New("stderr") );
        send_to->Call( stderr_obj, 1, &string_arg );
    }

    Local<Integer> umask_arg = arg->Get( String::New("umask") )->ToInteger();
    umask( umask_arg->Value() );

    if( !arg->Get( String::New("chroot") )->IsNull() )
    {
        char* dir = *String::AsciiValue( arg->Get( String::New("chroot") ) );
        chroot( dir );
    }

    if( !arg->Get( String::New("chdir") )->IsNull() )
    {
        char* dir = *String::AsciiValue( arg->Get( String::New("chdir") ) );
        chdir( dir );
    }

    return Integer::New(pid);
}

extern "C" void init(Handle<Object> target) {
	HandleScope scope;
	
	target->Set(String::New("start"), FunctionTemplate::New(Start)->GetFunction());
	target->Set(String::New("lock"), FunctionTemplate::New(LockD)->GetFunction());
	target->Set(String::New("closeIO"), FunctionTemplate::New(CloseIO)->GetFunction());
	target->Set(String::New("init"), FunctionTemplate::New(Init)->GetFunction());

        StreamPtr::Initialize(target);
}
