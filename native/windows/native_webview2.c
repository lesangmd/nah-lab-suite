/*
 * NAH LAB SUITE - Native Windows Desktop v1.3.27
 * Native Win32 host + Microsoft WebView2 Runtime.
 * Security contract:
 * - No msedge.exe --app shell, no Chrome/Edge browser profile.
 * - Persistent WebView2 user-data folder keeps offline content between launches.
 * - Authentication cookies are erased at launch/exit; password autosave remains disabled.
 * - Authenticated server data is the default read source; persisted snapshots are offline fallback.
 * - Server remains the source of truth for synchronized account data.
 *
 * Build: clang 17 + lld-link, x86_64-pc-windows-msvc, no CRT.
 */

typedef unsigned char BYTE;
typedef unsigned short WORD;
typedef unsigned int UINT;
typedef unsigned long DWORD;
typedef long LONG;
typedef unsigned long ULONG;
typedef long long LONGLONG;
typedef unsigned long long ULONGLONG;
#ifdef _WIN64
typedef long long LONG_PTR;
typedef unsigned long long ULONG_PTR;
#else
typedef long LONG_PTR;
typedef unsigned long ULONG_PTR;
#endif
typedef ULONG_PTR WPARAM;
typedef LONG_PTR LPARAM;
typedef LONG_PTR LRESULT;
typedef int BOOL;
typedef void* HANDLE;
typedef HANDLE HWND;
typedef HANDLE HINSTANCE;
typedef HANDLE HMODULE;
typedef HANDLE HICON;
typedef HANDLE HCURSOR;
typedef HANDLE HBRUSH;
typedef HANDLE HDC;
typedef HANDLE HFONT;
typedef HANDLE HGDIOBJ;
typedef HANDLE HMENU;
typedef const unsigned short* LPCWSTR;
typedef unsigned short* LPWSTR;
typedef void* LPVOID;
typedef const void* LPCVOID;
typedef unsigned short WCHAR;
typedef unsigned short ATOM;
typedef unsigned long COLORREF;
typedef LONG HRESULT;
typedef const void* REFIID;
typedef void* FARPROC;
typedef struct { DWORD Data1; WORD Data2; WORD Data3; BYTE Data4[8]; } GUID;
typedef struct { GUID fmtid; DWORD pid; } PROPERTYKEY;
typedef struct { WORD vt; WORD reserved1,reserved2,reserved3; WCHAR* pszVal; ULONGLONG reserved4; } PROPVARIANT;
typedef struct IPropertyStore IPropertyStore;
typedef struct {
    HRESULT (__stdcall *QueryInterface)(IPropertyStore*,REFIID,void**);
    ULONG (__stdcall *AddRef)(IPropertyStore*);
    ULONG (__stdcall *Release)(IPropertyStore*);
    HRESULT (__stdcall *GetCount)(IPropertyStore*,DWORD*);
    HRESULT (__stdcall *GetAt)(IPropertyStore*,DWORD,PROPERTYKEY*);
    HRESULT (__stdcall *GetValue)(IPropertyStore*,const PROPERTYKEY*,PROPVARIANT*);
    HRESULT (__stdcall *SetValue)(IPropertyStore*,const PROPERTYKEY*,const PROPVARIANT*);
    HRESULT (__stdcall *Commit)(IPropertyStore*);
} IPropertyStoreVtbl;
struct IPropertyStore { IPropertyStoreVtbl* lpVtbl; };

typedef struct { LONG x; LONG y; } POINT;
typedef struct { LONG left; LONG top; LONG right; LONG bottom; } RECT;
typedef struct {
    HDC hdc; BOOL fErase; RECT rcPaint; BOOL fRestore; BOOL fIncUpdate; BYTE rgbReserved[32];
} PAINTSTRUCT;
typedef struct {
    HWND hwnd; UINT message; WPARAM wParam; LPARAM lParam; DWORD time; POINT pt; DWORD lPrivate;
} MSG;
typedef LRESULT (__stdcall *WNDPROC)(HWND, UINT, WPARAM, LPARAM);
typedef struct {
    UINT style; WNDPROC lpfnWndProc; int cbClsExtra; int cbWndExtra; HINSTANCE hInstance;
    HICON hIcon; HCURSOR hCursor; HBRUSH hbrBackground; LPCWSTR lpszMenuName; LPCWSTR lpszClassName;
} WNDCLASSW;

typedef struct {
    DWORD dwFileAttributes;
    DWORD ftCreationTimeLow, ftCreationTimeHigh;
    DWORD ftLastAccessTimeLow, ftLastAccessTimeHigh;
    DWORD ftLastWriteTimeLow, ftLastWriteTimeHigh;
    DWORD nFileSizeHigh, nFileSizeLow;
    DWORD dwReserved0, dwReserved1;
    WCHAR cFileName[260];
    WCHAR cAlternateFileName[14];
} WIN32_FIND_DATAW;

/* Kernel32 */
__declspec(dllimport) void __stdcall ExitProcess(UINT);
__declspec(dllimport) HINSTANCE __stdcall GetModuleHandleW(LPCWSTR);
__declspec(dllimport) DWORD __stdcall GetModuleFileNameW(HINSTANCE, LPWSTR, DWORD);
__declspec(dllimport) DWORD __stdcall GetEnvironmentVariableW(LPCWSTR, LPWSTR, DWORD);
__declspec(dllimport) DWORD __stdcall GetFileAttributesW(LPCWSTR);
__declspec(dllimport) BOOL __stdcall SetFileAttributesW(LPCWSTR,DWORD);
__declspec(dllimport) BOOL __stdcall CreateDirectoryW(LPCWSTR, LPVOID);
__declspec(dllimport) BOOL __stdcall RemoveDirectoryW(LPCWSTR);
__declspec(dllimport) BOOL __stdcall DeleteFileW(LPCWSTR);
__declspec(dllimport) HANDLE __stdcall FindFirstFileW(LPCWSTR,WIN32_FIND_DATAW*);
__declspec(dllimport) BOOL __stdcall FindNextFileW(HANDLE,WIN32_FIND_DATAW*);
__declspec(dllimport) BOOL __stdcall FindClose(HANDLE);
__declspec(dllimport) HMODULE __stdcall LoadLibraryW(LPCWSTR);
__declspec(dllimport) BOOL __stdcall FreeLibrary(HMODULE);
__declspec(dllimport) FARPROC __stdcall GetProcAddress(HMODULE,const char*);
__declspec(dllimport) DWORD __stdcall GetCurrentProcessId(void);
__declspec(dllimport) ULONGLONG __stdcall GetTickCount64(void);
__declspec(dllimport) HANDLE __stdcall CreateMutexW(LPVOID,BOOL,LPCWSTR);
__declspec(dllimport) DWORD __stdcall GetLastError(void);
__declspec(dllimport) BOOL __stdcall CloseHandle(HANDLE);
__declspec(dllimport) void __stdcall Sleep(DWORD);

/* User32 */
__declspec(dllimport) ATOM __stdcall RegisterClassW(const WNDCLASSW*);
__declspec(dllimport) HWND __stdcall CreateWindowExW(DWORD,LPCWSTR,LPCWSTR,DWORD,int,int,int,int,HWND,HMENU,HINSTANCE,LPVOID);
__declspec(dllimport) LRESULT __stdcall DefWindowProcW(HWND,UINT,WPARAM,LPARAM);
__declspec(dllimport) BOOL __stdcall DestroyWindow(HWND);
__declspec(dllimport) void __stdcall PostQuitMessage(int);
__declspec(dllimport) BOOL __stdcall GetMessageW(MSG*,HWND,UINT,UINT);
__declspec(dllimport) BOOL __stdcall TranslateMessage(const MSG*);
__declspec(dllimport) LRESULT __stdcall DispatchMessageW(const MSG*);
__declspec(dllimport) int __stdcall GetSystemMetrics(int);
__declspec(dllimport) HDC __stdcall BeginPaint(HWND,PAINTSTRUCT*);
__declspec(dllimport) BOOL __stdcall EndPaint(HWND,const PAINTSTRUCT*);
__declspec(dllimport) BOOL __stdcall GetClientRect(HWND,RECT*);
__declspec(dllimport) int __stdcall FillRect(HDC,const RECT*,HBRUSH);
__declspec(dllimport) BOOL __stdcall InvalidateRect(HWND,const RECT*,BOOL);
__declspec(dllimport) HICON __stdcall LoadImageW(HINSTANCE,LPCWSTR,UINT,int,int,UINT);
__declspec(dllimport) HCURSOR __stdcall LoadCursorW(HINSTANCE,LPCWSTR);
__declspec(dllimport) int __stdcall MessageBoxW(HWND,LPCWSTR,LPCWSTR,UINT);
__declspec(dllimport) int __stdcall DrawTextW(HDC,LPCWSTR,int,RECT*,UINT);
__declspec(dllimport) BOOL __stdcall ShowWindow(HWND,int);
__declspec(dllimport) HWND __stdcall FindWindowW(LPCWSTR,LPCWSTR);
__declspec(dllimport) BOOL __stdcall SetForegroundWindow(HWND);
__declspec(dllimport) BOOL __stdcall UpdateWindow(HWND);
__declspec(dllimport) LRESULT __stdcall SendMessageW(HWND,UINT,WPARAM,LPARAM);

/* GDI32 */
__declspec(dllimport) HBRUSH __stdcall CreateSolidBrush(COLORREF);
__declspec(dllimport) HFONT __stdcall CreateFontW(int,int,int,int,int,DWORD,DWORD,DWORD,DWORD,DWORD,DWORD,DWORD,DWORD,LPCWSTR);
__declspec(dllimport) HGDIOBJ __stdcall SelectObject(HDC,HGDIOBJ);
__declspec(dllimport) BOOL __stdcall DeleteObject(HGDIOBJ);
__declspec(dllimport) int __stdcall SetBkMode(HDC,int);
__declspec(dllimport) COLORREF __stdcall SetTextColor(HDC,COLORREF);

/* Shell32 */
__declspec(dllimport) HANDLE __stdcall ShellExecuteW(HWND,LPCWSTR,LPCWSTR,LPCWSTR,LPCWSTR,int);

/* Ole32 */
__declspec(dllimport) HRESULT __stdcall CoInitializeEx(LPVOID,DWORD);
__declspec(dllimport) void __stdcall CoUninitialize(void);
__declspec(dllimport) void __stdcall CoTaskMemFree(LPVOID);

#define TRUE 1
#define FALSE 0
#define S_OK ((HRESULT)0)
#define E_POINTER ((HRESULT)0x80004003L)
#define E_NOINTERFACE ((HRESULT)0x80004002L)
#define FAILED(hr) (((LONG)(hr)) < 0)
#define SUCCEEDED(hr) (((LONG)(hr)) >= 0)
#define COINIT_APARTMENTTHREADED 0x2

#define WM_DESTROY 0x0002
#define WM_SIZE 0x0005
#define WM_PAINT 0x000F
#define WM_CLOSE 0x0010
#define WM_SETICON 0x0080
#define ICON_SMALL 0
#define ICON_BIG 1
#define WS_OVERLAPPEDWINDOW 0x00CF0000u
#define WS_VISIBLE 0x10000000u
#define WS_CLIPCHILDREN 0x02000000u
#define CW_USEDEFAULT ((int)0x80000000u)
#define SM_CXSCREEN 0
#define SM_CYSCREEN 1
#define IMAGE_ICON 1
#define LR_LOADFROMFILE 0x0010
#define LR_DEFAULTSIZE 0x0040
#define TRANSPARENT 1
#define DT_CENTER 0x0001
#define DT_VCENTER 0x0004
#define DT_SINGLELINE 0x0020
#define FW_BOLD 700
#define DEFAULT_CHARSET 1
#define OUT_DEFAULT_PRECIS 0
#define CLIP_DEFAULT_PRECIS 0
#define CLEARTYPE_QUALITY 5
#define DEFAULT_PITCH 0
#define FF_DONTCARE 0
#define MB_OK 0
#define MB_ICONERROR 0x10
#define MB_ICONINFORMATION 0x40
#define SW_SHOWNORMAL 1
#define SW_RESTORE 9
#define VT_LPWSTR 31
#define SW_MAXIMIZE 3
#define INVALID_FILE_ATTRIBUTES 0xFFFFFFFFu
#define INVALID_HANDLE_VALUE ((HANDLE)(LONG_PTR)-1)
#define FILE_ATTRIBUTE_DIRECTORY 0x10
#define FILE_ATTRIBUTE_NORMAL 0x80
#define ERROR_ALREADY_EXISTS 183

/* ---------- WebView2 minimal COM declarations ---------- */
typedef struct ICoreWebView2Environment ICoreWebView2Environment;
typedef struct ICoreWebView2Controller ICoreWebView2Controller;
typedef struct ICoreWebView2 ICoreWebView2;
typedef struct ICoreWebView2Settings ICoreWebView2Settings;
typedef struct ICoreWebView2Settings2 ICoreWebView2Settings2;
typedef struct ICoreWebView2Settings4 ICoreWebView2Settings4;
typedef struct ICoreWebView2_2 ICoreWebView2_2;
typedef struct ICoreWebView2CookieManager ICoreWebView2CookieManager;
typedef struct ICoreWebView2NewWindowRequestedEventArgs ICoreWebView2NewWindowRequestedEventArgs;
typedef struct NewWindowRequestedHandler NewWindowRequestedHandler;
typedef struct { LONGLONG value; } EventRegistrationToken;

typedef struct IUnknownVtbl {
    HRESULT (__stdcall *QueryInterface)(void*,REFIID,void**);
    ULONG (__stdcall *AddRef)(void*);
    ULONG (__stdcall *Release)(void*);
} IUnknownVtbl;

typedef struct ICoreWebView2EnvironmentVtbl {
    HRESULT (__stdcall *QueryInterface)(ICoreWebView2Environment*,REFIID,void**);
    ULONG (__stdcall *AddRef)(ICoreWebView2Environment*);
    ULONG (__stdcall *Release)(ICoreWebView2Environment*);
    HRESULT (__stdcall *CreateCoreWebView2Controller)(ICoreWebView2Environment*,HWND,void*);
    void* CreateWebResourceResponse;
    void* GetBrowserVersionString;
    void* AddNewBrowserVersionAvailable;
    void* RemoveNewBrowserVersionAvailable;
} ICoreWebView2EnvironmentVtbl;
struct ICoreWebView2Environment { ICoreWebView2EnvironmentVtbl* lpVtbl; };

typedef struct ICoreWebView2ControllerVtbl {
    HRESULT (__stdcall *QueryInterface)(ICoreWebView2Controller*,REFIID,void**);
    ULONG (__stdcall *AddRef)(ICoreWebView2Controller*);
    ULONG (__stdcall *Release)(ICoreWebView2Controller*);
    void* GetIsVisible;
    HRESULT (__stdcall *PutIsVisible)(ICoreWebView2Controller*,BOOL);
    void* GetBounds;
    HRESULT (__stdcall *PutBounds)(ICoreWebView2Controller*,RECT);
    void* GetZoomFactor;
    void* PutZoomFactor;
    void* AddZoomFactorChanged;
    void* RemoveZoomFactorChanged;
    void* SetBoundsAndZoomFactor;
    void* MoveFocus;
    void* AddMoveFocusRequested;
    void* RemoveMoveFocusRequested;
    void* AddGotFocus;
    void* RemoveGotFocus;
    void* AddLostFocus;
    void* RemoveLostFocus;
    void* AddAcceleratorKeyPressed;
    void* RemoveAcceleratorKeyPressed;
    void* GetParentWindow;
    void* PutParentWindow;
    void* NotifyParentWindowPositionChanged;
    HRESULT (__stdcall *Close)(ICoreWebView2Controller*);
    HRESULT (__stdcall *GetCoreWebView2)(ICoreWebView2Controller*,ICoreWebView2**);
} ICoreWebView2ControllerVtbl;
struct ICoreWebView2Controller { ICoreWebView2ControllerVtbl* lpVtbl; };

typedef struct ICoreWebView2Vtbl {
    HRESULT (__stdcall *QueryInterface)(ICoreWebView2*,REFIID,void**);
    ULONG (__stdcall *AddRef)(ICoreWebView2*);
    ULONG (__stdcall *Release)(ICoreWebView2*);
    HRESULT (__stdcall *GetSettings)(ICoreWebView2*,ICoreWebView2Settings**);
    void* GetSource;
    HRESULT (__stdcall *Navigate)(ICoreWebView2*,LPCWSTR);
    void* NavigateToString;
    void* AddNavigationStarting;
    void* RemoveNavigationStarting;
    void* AddContentLoading;
    void* RemoveContentLoading;
    void* AddSourceChanged;
    void* RemoveSourceChanged;
    void* AddHistoryChanged;
    void* RemoveHistoryChanged;
    void* AddNavigationCompleted;
    void* RemoveNavigationCompleted;
    void* AddFrameNavigationStarting;
    void* RemoveFrameNavigationStarting;
    void* AddFrameNavigationCompleted;
    void* RemoveFrameNavigationCompleted;
    void* AddScriptDialogOpening;
    void* RemoveScriptDialogOpening;
    void* AddPermissionRequested;
    void* RemovePermissionRequested;
    void* AddProcessFailed;
    void* RemoveProcessFailed;
    void* AddScriptToExecuteOnDocumentCreated;
    void* RemoveScriptToExecuteOnDocumentCreated;
    void* ExecuteScript;
    void* CapturePreview;
    void* Reload;
    void* PostWebMessageAsJSON;
    void* PostWebMessageAsString;
    void* AddWebMessageReceived;
    void* RemoveWebMessageReceived;
    void* CallDevToolsProtocolMethod;
    void* GetBrowserProcessID;
    void* GetCanGoBack;
    void* GetCanGoForward;
    void* GoBack;
    void* GoForward;
    void* GetDevToolsProtocolEventReceiver;
    void* Stop;
    HRESULT (__stdcall *AddNewWindowRequested)(ICoreWebView2*,NewWindowRequestedHandler*,EventRegistrationToken*);
    HRESULT (__stdcall *RemoveNewWindowRequested)(ICoreWebView2*,EventRegistrationToken);
    void* AddDocumentTitleChanged;
    void* RemoveDocumentTitleChanged;
    void* GetDocumentTitle;
    void* AddHostObjectToScript;
    void* RemoveHostObjectFromScript;
    void* OpenDevToolsWindow;
    void* AddContainsFullScreenElementChanged;
    void* RemoveContainsFullScreenElementChanged;
    void* GetContainsFullScreenElement;
    void* AddWebResourceRequested;
    void* RemoveWebResourceRequested;
    void* AddWebResourceRequestedFilter;
    void* RemoveWebResourceRequestedFilter;
    void* AddWindowCloseRequested;
    void* RemoveWindowCloseRequested;
} ICoreWebView2Vtbl;
struct ICoreWebView2 { ICoreWebView2Vtbl* lpVtbl; };

/* ICoreWebView2_2 exposes CookieManager. Used as a fail-closed fresh-login gate. */
typedef struct ICoreWebView2_2Vtbl {
    /* ICoreWebView2_2 derives from ICoreWebView2; COM vtable begins with the
     * complete base-interface layout, followed by the v2 additions. */
    ICoreWebView2Vtbl base;
    void* AddWebResourceResponseReceived;
    void* RemoveWebResourceResponseReceived;
    void* NavigateWithWebResourceRequest;
    void* AddDOMContentLoaded;
    void* RemoveDOMContentLoaded;
    HRESULT (__stdcall *GetCookieManager)(ICoreWebView2_2*,ICoreWebView2CookieManager**);
    void* GetEnvironment;
} ICoreWebView2_2Vtbl;
struct ICoreWebView2_2 { ICoreWebView2_2Vtbl* lpVtbl; };

typedef struct ICoreWebView2CookieManagerVtbl {
    HRESULT (__stdcall *QueryInterface)(ICoreWebView2CookieManager*,REFIID,void**);
    ULONG (__stdcall *AddRef)(ICoreWebView2CookieManager*);
    ULONG (__stdcall *Release)(ICoreWebView2CookieManager*);
    void* CreateCookie;
    void* CopyCookie;
    void* GetCookies;
    void* AddOrUpdateCookie;
    void* DeleteCookie;
    void* DeleteCookies;
    void* DeleteCookiesWithDomainAndPath;
    HRESULT (__stdcall *DeleteAllCookies)(ICoreWebView2CookieManager*);
} ICoreWebView2CookieManagerVtbl;
struct ICoreWebView2CookieManager { ICoreWebView2CookieManagerVtbl* lpVtbl; };

static const GUID IID_ICoreWebView2_2 = {0x9E8F0CF8,0xE670,0x4B5E,{0xB2,0xBC,0x73,0xE0,0x61,0xE3,0x18,0x4C}};

typedef struct ICoreWebView2SettingsVtbl {
    HRESULT (__stdcall *QueryInterface)(ICoreWebView2Settings*,REFIID,void**);
    ULONG (__stdcall *AddRef)(ICoreWebView2Settings*);
    ULONG (__stdcall *Release)(ICoreWebView2Settings*);
    void* GetIsScriptEnabled;
    HRESULT (__stdcall *PutIsScriptEnabled)(ICoreWebView2Settings*,BOOL);
    void* GetIsWebMessageEnabled;
    HRESULT (__stdcall *PutIsWebMessageEnabled)(ICoreWebView2Settings*,BOOL);
    void* GetAreDefaultScriptDialogsEnabled;
    HRESULT (__stdcall *PutAreDefaultScriptDialogsEnabled)(ICoreWebView2Settings*,BOOL);
    void* GetIsStatusBarEnabled;
    HRESULT (__stdcall *PutIsStatusBarEnabled)(ICoreWebView2Settings*,BOOL);
    void* GetAreDevToolsEnabled;
    HRESULT (__stdcall *PutAreDevToolsEnabled)(ICoreWebView2Settings*,BOOL);
    void* GetAreDefaultContextMenusEnabled;
    HRESULT (__stdcall *PutAreDefaultContextMenusEnabled)(ICoreWebView2Settings*,BOOL);
    void* GetAreHostObjectsAllowed;
    HRESULT (__stdcall *PutAreHostObjectsAllowed)(ICoreWebView2Settings*,BOOL);
    void* GetIsZoomControlEnabled;
    HRESULT (__stdcall *PutIsZoomControlEnabled)(ICoreWebView2Settings*,BOOL);
    void* GetIsBuiltInErrorPageEnabled;
    HRESULT (__stdcall *PutIsBuiltInErrorPageEnabled)(ICoreWebView2Settings*,BOOL);
} ICoreWebView2SettingsVtbl;
struct ICoreWebView2Settings { ICoreWebView2SettingsVtbl* lpVtbl; };

/* Settings2/4 are used to mark the native client at the HTTP User-Agent layer
 * and to disable WebView2 password/autofill persistence. Their COM vtables
 * include the inherited settings slots followed by the version additions. */
typedef struct ICoreWebView2Settings2Vtbl {
    ICoreWebView2SettingsVtbl base;
    HRESULT (__stdcall *GetUserAgent)(ICoreWebView2Settings2*,LPWSTR*);
    HRESULT (__stdcall *PutUserAgent)(ICoreWebView2Settings2*,LPCWSTR);
} ICoreWebView2Settings2Vtbl;
struct ICoreWebView2Settings2 { ICoreWebView2Settings2Vtbl* lpVtbl; };

typedef struct ICoreWebView2Settings4Vtbl {
    ICoreWebView2SettingsVtbl base;
    void* GetUserAgent;
    void* PutUserAgent;
    void* GetAreBrowserAcceleratorKeysEnabled;
    void* PutAreBrowserAcceleratorKeysEnabled;
    void* GetIsPasswordAutosaveEnabled;
    HRESULT (__stdcall *PutIsPasswordAutosaveEnabled)(ICoreWebView2Settings4*,BOOL);
    void* GetIsGeneralAutofillEnabled;
    HRESULT (__stdcall *PutIsGeneralAutofillEnabled)(ICoreWebView2Settings4*,BOOL);
} ICoreWebView2Settings4Vtbl;
struct ICoreWebView2Settings4 { ICoreWebView2Settings4Vtbl* lpVtbl; };

static const GUID IID_ICoreWebView2Settings2 = {0xEE9A0F68,0xF46C,0x4E32,{0xAC,0x23,0xEF,0x8C,0xAC,0x22,0x4D,0x2A}};
static const GUID IID_ICoreWebView2Settings4 = {0xCB56846C,0x4168,0x4D53,{0xB0,0x4F,0x03,0xB6,0xD6,0x79,0x6F,0xF2}};
static const WCHAR* NATIVE_UA_MARKER=(const WCHAR*)L"NAHISONative/1.3.27 NAHLABDesktop/1.3.27";

typedef struct ICoreWebView2NewWindowRequestedEventArgsVtbl {
    HRESULT (__stdcall *QueryInterface)(ICoreWebView2NewWindowRequestedEventArgs*,REFIID,void**);
    ULONG (__stdcall *AddRef)(ICoreWebView2NewWindowRequestedEventArgs*);
    ULONG (__stdcall *Release)(ICoreWebView2NewWindowRequestedEventArgs*);
    HRESULT (__stdcall *GetUri)(ICoreWebView2NewWindowRequestedEventArgs*,LPWSTR*);
    void* PutNewWindow;
    void* GetNewWindow;
    HRESULT (__stdcall *PutHandled)(ICoreWebView2NewWindowRequestedEventArgs*,BOOL);
    void* GetHandled;
    void* GetIsUserInitiated;
    void* GetDeferral;
    void* GetWindowFeatures;
} ICoreWebView2NewWindowRequestedEventArgsVtbl;
struct ICoreWebView2NewWindowRequestedEventArgs { ICoreWebView2NewWindowRequestedEventArgsVtbl* lpVtbl; };

typedef struct NewWindowRequestedHandlerVtbl {
    HRESULT (__stdcall *QueryInterface)(NewWindowRequestedHandler*,REFIID,void**);
    ULONG (__stdcall *AddRef)(NewWindowRequestedHandler*);
    ULONG (__stdcall *Release)(NewWindowRequestedHandler*);
    HRESULT (__stdcall *Invoke)(NewWindowRequestedHandler*,ICoreWebView2*,ICoreWebView2NewWindowRequestedEventArgs*);
} NewWindowRequestedHandlerVtbl;
struct NewWindowRequestedHandler { NewWindowRequestedHandlerVtbl* lpVtbl; LONG refs; };

/* Completion handlers */
typedef struct EnvCompletedHandler EnvCompletedHandler;
typedef struct ControllerCompletedHandler ControllerCompletedHandler;

typedef struct EnvCompletedHandlerVtbl {
    HRESULT (__stdcall *QueryInterface)(EnvCompletedHandler*,REFIID,void**);
    ULONG (__stdcall *AddRef)(EnvCompletedHandler*);
    ULONG (__stdcall *Release)(EnvCompletedHandler*);
    HRESULT (__stdcall *Invoke)(EnvCompletedHandler*,HRESULT,ICoreWebView2Environment*);
} EnvCompletedHandlerVtbl;
struct EnvCompletedHandler { EnvCompletedHandlerVtbl* lpVtbl; LONG refs; };

typedef struct ControllerCompletedHandlerVtbl {
    HRESULT (__stdcall *QueryInterface)(ControllerCompletedHandler*,REFIID,void**);
    ULONG (__stdcall *AddRef)(ControllerCompletedHandler*);
    ULONG (__stdcall *Release)(ControllerCompletedHandler*);
    HRESULT (__stdcall *Invoke)(ControllerCompletedHandler*,HRESULT,ICoreWebView2Controller*);
} ControllerCompletedHandlerVtbl;
struct ControllerCompletedHandler { ControllerCompletedHandlerVtbl* lpVtbl; LONG refs; };

typedef HRESULT (__stdcall *PFN_CreateWebViewEnvironmentWithOptionsInternal)(BOOL,int,LPCWSTR,void*,EnvCompletedHandler*);

static HWND g_hwnd = 0;
static HICON g_icon = 0;
static HANDLE g_mutex = 0;
static HMODULE g_runtime_module = 0;
static ICoreWebView2Environment* g_env = 0;
static ICoreWebView2Controller* g_controller = 0;
static ICoreWebView2* g_webview = 0;
static int g_ready = 0;
static int g_failed = 0;
static WCHAR g_session_root[1800];
static WCHAR g_session_dir[2000];
static WCHAR g_exe_dir[1800];
static WCHAR g_runtime_dll_path[2200];
static WCHAR g_start_url[2300];

static EnvCompletedHandler g_env_handler;
static ControllerCompletedHandler g_controller_handler;
static NewWindowRequestedHandler g_new_window_handler;
static EventRegistrationToken g_new_window_token;

static const WCHAR* APP_TITLE=(const WCHAR*)L"Bệnh viện Hữu nghị Đa khoa Nghệ An - Giai đoạn 2";
/* Windows uses the stable executable path as the taskbar identity.
 * Do not override it: pinned native .lnk files may not carry the same explicit AppID. */
static const WCHAR* APP_CLASS=(const WCHAR*)L"NAHLABSuiteNative130";
static const WCHAR* MUTEX_NAME=(const WCHAR*)L"Local\\NAH_LAB_SUITE_NATIVE_V130";

static UINT wlen(const WCHAR* s){ UINT n=0; while(s && s[n]) n++; return n; }
static void wcopy(WCHAR* d,const WCHAR* s,UINT cap){UINT i=0;if(!cap)return;while(s&&s[i]&&i+1<cap){d[i]=s[i];i++;}d[i]=0;}
static void wcat(WCHAR* d,const WCHAR* s,UINT cap){UINT n=wlen(d),i=0;if(n>=cap)return;while(s&&s[i]&&n+i+1<cap){d[n+i]=s[i];i++;}d[n+i]=0;}

/* One top-level window, one stable EXE path; Windows infers the Taskbar group.
 * No explicit process/window AppUserModelID or Relaunch* metadata. */

static int wprefix(const WCHAR* s,const WCHAR* p){UINT i=0;if(!s||!p)return 0;while(p[i]){if(s[i]!=p[i])return 0;i++;}return 1;}
static COLORREF rgb(BYTE r,BYTE g,BYTE b){return (COLORREF)(r|((DWORD)g<<8)|((DWORD)b<<16));}
static void exe_dir(WCHAR* out,UINT cap){DWORD n=GetModuleFileNameW(0,(LPWSTR)out,cap);if(!n||n>=cap){out[0]=0;return;}while(n>0){if(out[n-1]=='\\'||out[n-1]=='/'){out[n]=0;return;}n--;}out[0]=0;}

static int is_dot_name(const WCHAR* s){return (s[0]=='.'&&s[1]==0)||(s[0]=='.'&&s[1]=='.'&&s[2]==0);}
static int prepare_session_dir(void){
    WCHAR base[1400], appdir[1800];
    base[0]=0;
    if(GetEnvironmentVariableW((LPCWSTR)L"LOCALAPPDATA",base,1400)==0) return 0;
    wcopy(appdir,base,1800); wcat(appdir,(const WCHAR*)L"\\NAH LAB SUITE",1800); CreateDirectoryW(appdir,0);
    wcopy(g_session_root,appdir,1800);
    wcopy(g_session_dir,appdir,2000); wcat(g_session_dir,(const WCHAR*)L"\\WebView2Data",2000);
    return CreateDirectoryW(g_session_dir,0) || GetFileAttributesW(g_session_dir)!=INVALID_FILE_ATTRIBUTES;
}

static void build_native_start_url(void){
    WCHAR path[2200]; UINT i=0,j=0;
    wcopy(path,g_exe_dir,2200); wcat(path,(const WCHAR*)L"offline\\index.html",2200);
    wcopy(g_start_url,(const WCHAR*)L"file:///",2300); j=wlen(g_start_url);
    for(i=0; path[i] && j+4<2299; i++){
        WCHAR c=path[i];
        if(c=='\\') g_start_url[j++]='/';
        else if(c==' '){ g_start_url[j++]='%'; g_start_url[j++]='2'; g_start_url[j++]='0'; }
        else g_start_url[j++]=c;
    }
    g_start_url[j]=0;
}

static int file_exists(const WCHAR* path){
    DWORD a=GetFileAttributesW(path);
    return a!=INVALID_FILE_ATTRIBUTES && !(a&FILE_ATTRIBUTE_DIRECTORY);
}

static int parse_version4(const WCHAR* s,UINT v[4]){
    UINT i=0,k=0,n=0,have=0; for(i=0;i<4;i++)v[i]=0;
    while(s&&s[k]&&i<4){
        WCHAR c=s[k++];
        if(c>='0'&&c<='9'){n=n*10+(UINT)(c-'0');have=1;}
        else if(c=='.'){if(!have)return 0;v[i++]=n;n=0;have=0;}
        else return 0;
    }
    if(!have||i>3)return 0;v[i++]=n;while(i<4)v[i++]=0;return 1;
}
static int version_gt(const WCHAR* a,const WCHAR* b){
    UINT va[4],vb[4],i;if(!parse_version4(a,va))return 0;if(!parse_version4(b,vb))return 1;
    for(i=0;i<4;i++){if(va[i]>vb[i])return 1;if(va[i]<vb[i])return 0;}return 0;
}
static int search_runtime_version_dirs(const WCHAR* base,WCHAR* out,UINT cap){
    WCHAR pattern[2100],candidate[2400],best[260]; WIN32_FIND_DATAW fd; HANDLE h; best[0]=0;
    wcopy(pattern,base,2100);wcat(pattern,(const WCHAR*)L"\\*",2100);
    h=FindFirstFileW(pattern,&fd);if(h==INVALID_HANDLE_VALUE)return 0;
    do{
        if(!(fd.dwFileAttributes&FILE_ATTRIBUTE_DIRECTORY)||is_dot_name(fd.cFileName))continue;
        wcopy(candidate,base,2400);wcat(candidate,(const WCHAR*)L"\\",2400);wcat(candidate,fd.cFileName,2400);
        wcat(candidate,(const WCHAR*)L"\\EBWebView\\x64\\EmbeddedBrowserWebView.dll",2400);
        if(file_exists(candidate)&&(!best[0]||version_gt(fd.cFileName,best)))wcopy(best,fd.cFileName,260);
    }while(FindNextFileW(h,&fd));
    FindClose(h);if(!best[0])return 0;
    wcopy(out,base,cap);wcat(out,(const WCHAR*)L"\\",cap);wcat(out,best,cap);wcat(out,(const WCHAR*)L"\\EBWebView\\x64\\EmbeddedBrowserWebView.dll",cap);return 1;
}

static int find_runtime_client_dll(WCHAR* out,UINT cap,int* runtime_type){
    WCHAR env[1600],base[2100]; DWORD n;
    exe_dir(g_exe_dir,1800);
    /* Optional fully portable Fixed Version Runtime: .\\runtime\\EBWebView\\x64\\EmbeddedBrowserWebView.dll */
    wcopy(out,g_exe_dir,cap);wcat(out,(const WCHAR*)L"runtime\\EBWebView\\x64\\EmbeddedBrowserWebView.dll",cap);
    if(file_exists(out)){if(runtime_type)*runtime_type=1;return 1;}
    /* Also accept an extracted Microsoft Fixed Version folder kept under .\runtime\<version>\... */
    wcopy(base,g_exe_dir,2100);wcat(base,(const WCHAR*)L"runtime",2100);
    if(search_runtime_version_dirs(base,out,cap)){if(runtime_type)*runtime_type=1;return 1;}
    /* User-mode discovery of an already provisioned Evergreen WebView2 Runtime. No installer/elevation. */
    n=GetEnvironmentVariableW((LPCWSTR)L"ProgramFiles(x86)",env,1600);
    if(n&&n<1600){wcopy(base,env,2100);wcat(base,(const WCHAR*)L"\\Microsoft\\EdgeWebView\\Application",2100);if(search_runtime_version_dirs(base,out,cap)){if(runtime_type)*runtime_type=0;return 1;}}
    n=GetEnvironmentVariableW((LPCWSTR)L"ProgramFiles",env,1600);
    if(n&&n<1600){wcopy(base,env,2100);wcat(base,(const WCHAR*)L"\\Microsoft\\EdgeWebView\\Application",2100);if(search_runtime_version_dirs(base,out,cap)){if(runtime_type)*runtime_type=0;return 1;}}
    n=GetEnvironmentVariableW((LPCWSTR)L"LOCALAPPDATA",env,1600);
    if(n&&n<1600){wcopy(base,env,2100);wcat(base,(const WCHAR*)L"\\Microsoft\\EdgeWebView\\Application",2100);if(search_runtime_version_dirs(base,out,cap)){if(runtime_type)*runtime_type=0;return 1;}}
    out[0]=0;return 0;
}

static void resize_webview(void){
    RECT rc;
    if(g_controller && g_hwnd && GetClientRect(g_hwnd,&rc)) g_controller->lpVtbl->PutBounds(g_controller,rc);
}

static HRESULT __stdcall handler_qi(void* self,REFIID riid,void** out){(void)riid;if(!out)return E_POINTER;*out=self;return S_OK;}
static ULONG __stdcall env_addref(EnvCompletedHandler* self){return (ULONG)(++self->refs);}
static ULONG __stdcall env_release(EnvCompletedHandler* self){if(self->refs>1)--self->refs;return (ULONG)self->refs;}
static ULONG __stdcall ctl_addref(ControllerCompletedHandler* self){return (ULONG)(++self->refs);}
static ULONG __stdcall ctl_release(ControllerCompletedHandler* self){if(self->refs>1)--self->refs;return (ULONG)self->refs;}

static void fail_with_message(const WCHAR* msg){g_failed=1;MessageBoxW(g_hwnd,msg,APP_TITLE,MB_OK|MB_ICONERROR);DestroyWindow(g_hwnd);}

static ULONG __stdcall new_addref(NewWindowRequestedHandler* self){return (ULONG)(++self->refs);}
static ULONG __stdcall new_release(NewWindowRequestedHandler* self){if(self->refs>1)--self->refs;return (ULONG)self->refs;}
static HRESULT __stdcall new_window_requested(NewWindowRequestedHandler* self,ICoreWebView2* sender,ICoreWebView2NewWindowRequestedEventArgs* args){
    LPWSTR uri=0; (void)self;
    if(!args)return S_OK;
    if(SUCCEEDED(args->lpVtbl->GetUri(args,&uri))&&uri&&uri[0]){
        if(wprefix(uri,(const WCHAR*)L"nahiso-update://install")){
            WCHAR script[2100];
            script[0]=0;
            wcopy(script,g_exe_dir,2100);
            wcat(script,(const WCHAR*)L"\\NAH-UPDATE.cmd",2100);
            ShellExecuteW(g_hwnd,(const WCHAR*)L"open",script,0,g_exe_dir,SW_SHOWNORMAL);
            CoTaskMemFree(uri);
            args->lpVtbl->PutHandled(args,TRUE);
            return S_OK;
        }
        if(wprefix(uri,(const WCHAR*)L"https://sachyhoc.com/nah-lab-iso/")){
            if(sender)sender->lpVtbl->Navigate(sender,uri);
        }else{
            ShellExecuteW(g_hwnd,(LPCWSTR)L"open",uri,0,0,SW_SHOWNORMAL);
        }
        CoTaskMemFree(uri);
    }
    args->lpVtbl->PutHandled(args,TRUE);
    return S_OK;
}

static HRESULT configure_native_identity_and_privacy(ICoreWebView2Settings* settings){
    ICoreWebView2Settings2* s2=0;
    ICoreWebView2Settings4* s4=0;
    LPWSTR ua=0;
    WCHAR marked[2048];
    HRESULT hr;
    if(!settings || !settings->lpVtbl || !settings->lpVtbl->QueryInterface) return E_NOINTERFACE;

    /* The server fresh-start guard relies on a real HTTP User-Agent marker,
     * not a JavaScript override. Preserve the runtime UA and append our token. */
    hr=settings->lpVtbl->QueryInterface(settings,(REFIID)&IID_ICoreWebView2Settings2,(void**)&s2);
    if(FAILED(hr)||!s2) return FAILED(hr)?hr:E_NOINTERFACE;
    hr=s2->lpVtbl->GetUserAgent(s2,&ua);
    if(FAILED(hr)||!ua){s2->lpVtbl->base.Release((ICoreWebView2Settings*)s2);return FAILED(hr)?hr:E_NOINTERFACE;}
    marked[0]=0; wcopy(marked,ua,2048); CoTaskMemFree(ua); ua=0;
    wcat(marked,(const WCHAR*)L" ",2048); wcat(marked,NATIVE_UA_MARKER,2048);
    hr=s2->lpVtbl->PutUserAgent(s2,marked);
    s2->lpVtbl->base.Release((ICoreWebView2Settings*)s2); s2=0;
    if(FAILED(hr)) return hr;

    /* Disable browser credential persistence/autofill at the native engine
     * level. The HTML form also sets autocomplete=off, but this is the
     * authoritative WebView2-side control. */
    hr=settings->lpVtbl->QueryInterface(settings,(REFIID)&IID_ICoreWebView2Settings4,(void**)&s4);
    if(FAILED(hr)||!s4) return FAILED(hr)?hr:E_NOINTERFACE;
    hr=s4->lpVtbl->PutIsPasswordAutosaveEnabled(s4,FALSE);
    if(SUCCEEDED(hr)) hr=s4->lpVtbl->PutIsGeneralAutofillEnabled(s4,FALSE);
    s4->lpVtbl->base.Release((ICoreWebView2Settings*)s4);
    return hr;
}

static HRESULT clear_all_webview_cookies(ICoreWebView2* webview){
    ICoreWebView2_2* webview2=0;
    ICoreWebView2CookieManager* cookies=0;
    HRESULT hr;
    if(!webview || !webview->lpVtbl || !webview->lpVtbl->QueryInterface) return E_NOINTERFACE;
    hr=webview->lpVtbl->QueryInterface(webview,(REFIID)&IID_ICoreWebView2_2,(void**)&webview2);
    if(FAILED(hr)||!webview2) return FAILED(hr)?hr:E_NOINTERFACE;
    hr=webview2->lpVtbl->GetCookieManager(webview2,&cookies);
    if(SUCCEEDED(hr)&&cookies){
        hr=cookies->lpVtbl->DeleteAllCookies(cookies);
        cookies->lpVtbl->Release(cookies);
    }
    webview2->lpVtbl->base.Release((ICoreWebView2*)webview2);
    return hr;
}

static HRESULT __stdcall controller_completed(ControllerCompletedHandler* self,HRESULT result,ICoreWebView2Controller* controller){
    ICoreWebView2Settings* settings=0; HRESULT hr;
    (void)self;
    if(FAILED(result)||!controller){fail_with_message((const WCHAR*)L"Không thể khởi tạo WebView2. Ứng dụng chạy portable và không yêu cầu quyền Admin; vui lòng liên hệ CNTT nếu máy chưa có WebView2 Runtime.");return result;}
    g_controller=controller; g_controller->lpVtbl->AddRef(g_controller);
    hr=g_controller->lpVtbl->GetCoreWebView2(g_controller,&g_webview);
    if(FAILED(hr)||!g_webview){fail_with_message((const WCHAR*)L"Không thể tạo nội dung WebView2.");return hr;}
    g_webview->lpVtbl->AddRef(g_webview);
    /* Local-account boundary: clear browser cookies while preserving the enrolled device token and
     * IndexedDB/localStorage in the stable WebView2 user-data folder. */
    hr=clear_all_webview_cookies(g_webview);
    if(FAILED(hr)){
        fail_with_message((const WCHAR*)L"Không thể tạo phiên đăng nhập mới an toàn. Ứng dụng đã dừng để tránh sử dụng lại phiên đăng nhập cũ.");
        return hr;
    }
    if(SUCCEEDED(g_webview->lpVtbl->GetSettings(g_webview,&settings))&&settings){
        hr=configure_native_identity_and_privacy(settings);
        if(FAILED(hr)){
            settings->lpVtbl->Release(settings);
            fail_with_message((const WCHAR*)L"WebView2 Runtime không đáp ứng chính sách bảo mật đăng nhập của NAH LAB SUITE. Vui lòng liên hệ CNTT để cập nhật Runtime.");
            return hr;
        }
        settings->lpVtbl->PutIsScriptEnabled(settings,TRUE);
        settings->lpVtbl->PutIsWebMessageEnabled(settings,TRUE);
        settings->lpVtbl->PutAreDefaultScriptDialogsEnabled(settings,TRUE);
        settings->lpVtbl->PutIsStatusBarEnabled(settings,FALSE);
        settings->lpVtbl->PutAreDevToolsEnabled(settings,FALSE);
        settings->lpVtbl->PutAreDefaultContextMenusEnabled(settings,FALSE);
        settings->lpVtbl->PutAreHostObjectsAllowed(settings,FALSE);
        settings->lpVtbl->PutIsZoomControlEnabled(settings,FALSE);
        settings->lpVtbl->Release(settings);
    }
    if(g_webview->lpVtbl->AddNewWindowRequested && g_new_window_handler.lpVtbl){
        g_webview->lpVtbl->AddNewWindowRequested(g_webview,&g_new_window_handler,&g_new_window_token);
    }
    resize_webview();
    g_controller->lpVtbl->PutIsVisible(g_controller,TRUE);
    build_native_start_url();
    hr=g_webview->lpVtbl->Navigate(g_webview,g_start_url);
    if(FAILED(hr)){fail_with_message((const WCHAR*)L"Không thể mở NAH LAB SUITE.");return hr;}
    g_ready=1; InvalidateRect(g_hwnd,0,TRUE);
    return S_OK;
}

static HRESULT __stdcall environment_completed(EnvCompletedHandler* self,HRESULT result,ICoreWebView2Environment* env){
    HRESULT hr; (void)self;
    if(FAILED(result)||!env){fail_with_message((const WCHAR*)L"Không tìm thấy Microsoft WebView2 Runtime hoặc Runtime không khởi tạo được. Ứng dụng không tự cài đặt thành phần hệ thống.");return result;}
    g_env=env; g_env->lpVtbl->AddRef(g_env);
    hr=g_env->lpVtbl->CreateCoreWebView2Controller(g_env,g_hwnd,&g_controller_handler);
    if(FAILED(hr)) fail_with_message((const WCHAR*)L"Không thể tạo WebView2 Controller.");
    return hr;
}

static EnvCompletedHandlerVtbl g_env_vtbl={(void*)handler_qi,env_addref,env_release,environment_completed};
static ControllerCompletedHandlerVtbl g_ctl_vtbl={(void*)handler_qi,ctl_addref,ctl_release,controller_completed};
static NewWindowRequestedHandlerVtbl g_new_vtbl={(void*)handler_qi,new_addref,new_release,new_window_requested};

static void draw_loading(HWND hwnd){
    PAINTSTRUCT ps; RECT rc; HDC dc=BeginPaint(hwnd,&ps); HBRUSH bg=CreateSolidBrush(rgb(248,252,251));
    GetClientRect(hwnd,&rc); FillRect(dc,&rc,bg); DeleteObject(bg);
    SetBkMode(dc,TRANSPARENT);
    {
        HFONT title=CreateFontW(-30,0,0,0,FW_BOLD,0,0,0,DEFAULT_CHARSET,OUT_DEFAULT_PRECIS,CLIP_DEFAULT_PRECIS,CLEARTYPE_QUALITY,DEFAULT_PITCH|FF_DONTCARE,(LPCWSTR)L"Segoe UI");
        HFONT sub=CreateFontW(-18,0,0,0,400,0,0,0,DEFAULT_CHARSET,OUT_DEFAULT_PRECIS,CLIP_DEFAULT_PRECIS,CLEARTYPE_QUALITY,DEFAULT_PITCH|FF_DONTCARE,(LPCWSTR)L"Segoe UI");
        RECT t=rc,s=rc; t.top=(rc.bottom-rc.top)/2-55; t.bottom=t.top+46; s.top=t.bottom+6; s.bottom=s.top+38;
        SelectObject(dc,title); SetTextColor(dc,rgb(10,50,70)); DrawTextW(dc,APP_TITLE,-1,&t,DT_CENTER|DT_VCENTER|DT_SINGLELINE);
        SelectObject(dc,sub); SetTextColor(dc,g_failed?rgb(180,45,45):rgb(0,126,112));
        DrawTextW(dc,g_failed?(const WCHAR*)L"Khởi tạo không thành công":(const WCHAR*)L"Đang mở NAH LAB SUITE...",-1,&s,DT_CENTER|DT_VCENTER|DT_SINGLELINE);
        DeleteObject(title);DeleteObject(sub);
    }
    EndPaint(hwnd,&ps);
}

static LRESULT __stdcall WndProc(HWND hwnd,UINT msg,WPARAM wp,LPARAM lp){
    (void)wp;(void)lp;
    if(msg==WM_SIZE){resize_webview();return 0;}
    if(msg==WM_PAINT){if(!g_ready)draw_loading(hwnd);else{PAINTSTRUCT ps;BeginPaint(hwnd,&ps);EndPaint(hwnd,&ps);}return 0;}
    if(msg==WM_CLOSE){
        /* Closing with the X is a security boundary: erase WebView cookies
         * before the controller is torn down, then destroy the native host. */
        if(g_webview) (void)clear_all_webview_cookies(g_webview);
        if(g_controller) g_controller->lpVtbl->PutIsVisible(g_controller,FALSE);
        DestroyWindow(hwnd);return 0;
    }
    if(msg==WM_DESTROY){PostQuitMessage(0);return 0;}
    return DefWindowProcW(hwnd,msg,wp,lp);
}

static int init_webview2(void){
    PFN_CreateWebViewEnvironmentWithOptionsInternal create_internal;
    HRESULT hr; int runtime_type=0;
    exe_dir(g_exe_dir,1800);
    if(!find_runtime_client_dll(g_runtime_dll_path,2200,&runtime_type)){
        MessageBoxW(g_hwnd,(const WCHAR*)L"Máy chưa có Microsoft WebView2 Runtime. Ứng dụng Windows là bản cài đặt độc lập, không tự cài đặt và không cần quyền Admin. Vui lòng liên hệ CNTT để triển khai WebView2 Runtime ở cấp hệ thống, hoặc đặt Fixed Version Runtime vào thư mục runtime của ứng dụng.",APP_TITLE,MB_OK|MB_ICONERROR);
        return 0;
    }
    g_runtime_module=LoadLibraryW(g_runtime_dll_path);
    if(!g_runtime_module){
        MessageBoxW(g_hwnd,(const WCHAR*)L"Không thể nạp Microsoft WebView2 Runtime trên máy này.",APP_TITLE,MB_OK|MB_ICONERROR);
        return 0;
    }
    create_internal=(PFN_CreateWebViewEnvironmentWithOptionsInternal)GetProcAddress(g_runtime_module,"CreateWebViewEnvironmentWithOptionsInternal");
    if(!create_internal){
        MessageBoxW(g_hwnd,(const WCHAR*)L"WebView2 Runtime không tương thích với NAH LAB SUITE.",APP_TITLE,MB_OK|MB_ICONERROR);
        return 0;
    }
    if(!prepare_session_dir()){
        MessageBoxW(g_hwnd,(const WCHAR*)L"Không thể tạo vùng dữ liệu offline bảo mật cho ứng dụng.",APP_TITLE,MB_OK|MB_ICONERROR);
        return 0;
    }
    g_env_handler.lpVtbl=&g_env_vtbl;g_env_handler.refs=1;
    g_controller_handler.lpVtbl=&g_ctl_vtbl;g_controller_handler.refs=1;
    g_new_window_handler.lpVtbl=&g_new_vtbl;g_new_window_handler.refs=1;
    g_new_window_token.value=0;
    hr=create_internal(TRUE,runtime_type,g_session_dir,0,&g_env_handler);
    if(FAILED(hr)){
        MessageBoxW(g_hwnd,(const WCHAR*)L"Không thể khởi tạo Microsoft WebView2 Runtime.",APP_TITLE,MB_OK|MB_ICONERROR);
        return 0;
    }
    return 1;
}

static void cleanup_webview2(void){
    if(g_webview) (void)clear_all_webview_cookies(g_webview);
    if(g_controller)g_controller->lpVtbl->PutIsVisible(g_controller,FALSE);
    if(g_controller)g_controller->lpVtbl->Close(g_controller);
    if(g_webview){g_webview->lpVtbl->Release(g_webview);g_webview=0;}
    if(g_controller){g_controller->lpVtbl->Release(g_controller);g_controller=0;}
    if(g_env){g_env->lpVtbl->Release(g_env);g_env=0;}
    if(g_runtime_module){FreeLibrary(g_runtime_module);g_runtime_module=0;}
    Sleep(250);
}

void wWinMainCRTStartup(void){
    HINSTANCE hi;WNDCLASSW wc;MSG m;HRESULT chr;int sw,sh;RECT dummy; (void)dummy;
    g_mutex=CreateMutexW(0,TRUE,MUTEX_NAME);
    if(g_mutex&&GetLastError()==ERROR_ALREADY_EXISTS){
        /* A pinned shortcut should activate the existing window, not show
         * a second MessageBox/taskbar button and exit. */
        HWND existing=FindWindowW(APP_CLASS,0);
        if(existing){ShowWindow(existing,SW_RESTORE);SetForegroundWindow(existing);}
        ExitProcess(0);
    }
    chr=CoInitializeEx(0,COINIT_APARTMENTTHREADED);
    (void)chr;
    hi=GetModuleHandleW(0);
    exe_dir(g_exe_dir,1800);
    /* No SetCurrentProcessExplicitAppUserModelID here. An explicit identity on
     * the process with an implicit/mismatched pinned link creates two Taskbar
     * buttons. For this single-window EXE, use the normal shell identity. */
    /* Resource ID 1 is embedded in the executable; no external icon is required. */
    g_icon=LoadImageW(hi,(LPCWSTR)(ULONG_PTR)1,IMAGE_ICON,0,0,LR_DEFAULTSIZE);
    {
        BYTE* p=(BYTE*)&wc;UINT i;for(i=0;i<sizeof(wc);i++)p[i]=0;
    }
    wc.style=0x0003;wc.lpfnWndProc=WndProc;wc.hInstance=hi;wc.hCursor=LoadCursorW(0,(LPCWSTR)(ULONG_PTR)32512);wc.lpszClassName=APP_CLASS;wc.hIcon=g_icon;
    if(!RegisterClassW(&wc)){CoUninitialize();ExitProcess(2);}
    sw=GetSystemMetrics(SM_CXSCREEN);sh=GetSystemMetrics(SM_CYSCREEN);
    g_hwnd=CreateWindowExW(0,APP_CLASS,APP_TITLE,WS_OVERLAPPEDWINDOW|WS_CLIPCHILDREN,CW_USEDEFAULT,CW_USEDEFAULT,sw>1200?1200:sw-80,sh>800?800:sh-80,0,0,hi,0);
    if(!g_hwnd){CoUninitialize();ExitProcess(3);}
    if(g_icon){SendMessageW(g_hwnd,WM_SETICON,ICON_BIG,(LPARAM)g_icon);SendMessageW(g_hwnd,WM_SETICON,ICON_SMALL,(LPARAM)g_icon);}
    /* No per-window AppUserModelID or relaunch metadata. The shell groups
     * this top-level HWND with the native shortcut by executable path. */
    ShowWindow(g_hwnd,SW_MAXIMIZE);UpdateWindow(g_hwnd);
    if(!init_webview2()){DestroyWindow(g_hwnd);}
    while(GetMessageW(&m,0,0,0)>0){TranslateMessage(&m);DispatchMessageW(&m);}
    cleanup_webview2();
    CoUninitialize();
    if(g_mutex)CloseHandle(g_mutex);
    ExitProcess(0);
}
