using JobSearchAssistant.Maui.Services;

namespace JobSearchAssistant.Maui;

public partial class MainPage : TabbedPage
{
    private readonly AppStateService _stateService = new();

    public MainPage()
    {
        InitializeComponent();

        var theme = Application.Current?.RequestedTheme ?? AppTheme.Unspecified;
        var TabBackgroundColorKey = theme == AppTheme.Dark ? "TabbedBarBackgroundDarkColor" : "TabbedBarBackgroundColor";

        if (Application.Current?.Resources.TryGetValue(TabBackgroundColorKey, out var primaryColor) == true)
        {
            BarBackgroundColor = primaryColor is SolidColorBrush brush ? brush.Color : (Color)primaryColor;
        }

        var TabTextColorKey = theme == AppTheme.Dark ? "TabbedBarTextDarkColor" : "TabbedBarTextColor";

        if (Application.Current?.Resources.TryGetValue(TabTextColorKey, out var whiteColor) == true)
        {
            var color = whiteColor is SolidColorBrush brush ? brush.Color : (Color)whiteColor;
            BarTextColor = color;
            SelectedTabColor = color;
        }

        if (Application.Current?.Resources.TryGetValue("PrimaryDark", out var primaryDarkColor) == true)
        {
            UnselectedTabColor = primaryDarkColor is SolidColorBrush brush ? brush.Color : (Color)primaryDarkColor;
        }
    }

    protected override void OnCurrentPageChanged()
    {
        base.OnCurrentPageChanged();
        var state = _stateService.LoadState();
        state.Navigation.SelectedTabIndex = Children.IndexOf(CurrentPage);
        _stateService.SaveState(state);
    }
}