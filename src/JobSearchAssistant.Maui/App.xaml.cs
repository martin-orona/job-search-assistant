using JobSearchAssistant.Maui.Services;

#if WINDOWS
using Microsoft.UI;
using Microsoft.UI.Windowing;
using WinRT.Interop;
#endif

namespace JobSearchAssistant.Maui;

public partial class App : Application
{
    private Window? _window;
    private AppStateService? _stateService;

    public App()
    {
        InitializeComponent();
        _stateService = new AppStateService();
    }

    protected override Window CreateWindow(IActivationState? activationState)
    {
        var mainPage = new MainPage();
        _window = new Window(mainPage);

        // Load and apply saved state
        var state = _stateService!.LoadState();

        // Set window size and position
        if (state.Window.Width > 0 && state.Window.Height > 0)
        {
            _window.Width = state.Window.Width;
            _window.Height = state.Window.Height;
        }

        if (state.Window.X >= 0 && state.Window.Y >= 0)
        {
            _window.X = state.Window.X;
            _window.Y = state.Window.Y;
        }

#if WINDOWS
        _window.Created += (_, _) =>
        {
            SetWindowsIcon();
            mainPage.RestoreSelectedTab(state.Navigation.SelectedTabIndex);
        };
#else
        _window.Created += (_, _) => mainPage.RestoreSelectedTab(state.Navigation.SelectedTabIndex);
#endif

        // Save state when window is destroyed
        _window.Destroying += (s, e) => SaveState();

        return _window;
    }

#if WINDOWS
    private void SetWindowsIcon()
    {
        var nativeWindow = (MauiWinUIWindow)_window!.Handler!.PlatformView!;
        var windowHandle = WindowNative.GetWindowHandle(nativeWindow);
        var windowId = Win32Interop.GetWindowIdFromWindow(windowHandle);
        var appWindow = AppWindow.GetFromWindowId(windowId);
        appWindow.SetIcon(Path.Combine(AppContext.BaseDirectory, "appicon.ico"));
    }
#endif

    private void SaveState()
    {
        if (_window == null || _stateService == null)
        {
            return;
        }

        var mainPage = _window.Page as MainPage;
        if (mainPage == null)
        {
            return;
        }

        // Load existing state to preserve any other data
        var state = _stateService.LoadState();

        // Update only the window state
        state.Window.X = _window.X;
        state.Window.Y = _window.Y;
        state.Window.Width = _window.Width;
        state.Window.Height = _window.Height;

        // Update the tab selection
        state.Navigation.SelectedTabIndex = mainPage.SelectedTabIndex;

        _stateService.SaveState(state);

        var restate = _stateService.LoadState();
    }
}
