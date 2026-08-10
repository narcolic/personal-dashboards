FROM mcr.microsoft.com/dotnet/sdk:10.0 AS build
ARG BUILD_CONFIGURATION=Release
WORKDIR /src

# Restore from project files first so Docker can reuse the NuGet cache when
# application source files change.
COPY Directory.Build.props global.json PortfolioTerminal.sln ./
COPY src/App.Api/App.Api.csproj src/App.Api/
COPY src/App.CarService/App.CarService.csproj src/App.CarService/
COPY src/App.Data/App.Data.csproj src/App.Data/
COPY src/App.Portfolio/App.Portfolio.csproj src/App.Portfolio/
RUN dotnet restore src/App.Api/App.Api.csproj

COPY src/ src/
RUN dotnet publish src/App.Api/App.Api.csproj \
    --configuration $BUILD_CONFIGURATION \
    --output /app/publish \
    --no-restore \
    /p:UseAppHost=false

FROM mcr.microsoft.com/dotnet/aspnet:10.0 AS runtime
WORKDIR /app
ENV ASPNETCORE_HTTP_PORTS=8080
EXPOSE 8080

COPY --from=build /app/publish .
USER $APP_UID
ENTRYPOINT ["dotnet", "App.Api.dll"]
