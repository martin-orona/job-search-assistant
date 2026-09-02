using JobSearchAssistant.Maui;

namespace JobSearchAssistant.Maui.Utilities;

public static class Navigation
{
    public static T? GetPage<T>() where T : Page
    {
        MainPage? mainPage = Application.Current?.Windows.FirstOrDefault()?.Page as MainPage;
        T? page = mainPage?.Children.OfType<T>().FirstOrDefault();
        return page;
    }

    public static T? FocusPage<T>() where T : Page
    {
        MainPage? mainPage = Application.Current?.Windows.FirstOrDefault()?.Page as MainPage;
        T? page = GetPage<T>();
        if (mainPage is not null && page is not null)
        {
            mainPage.CurrentPage = page;
        }

        return page;
    }
}
