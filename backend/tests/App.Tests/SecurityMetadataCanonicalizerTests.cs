using PortfolioTerminal.Portfolio.SecurityMetadata;

namespace PortfolioTerminal.Tests;

public sealed class SecurityMetadataCanonicalizerTests
{
    [Theory]
    [InlineData("SEMICONDUCTORS", "Semiconductors")]
    [InlineData("  SOFTWARE   & SERVICES  ", "Software & Services")]
    public void DiscoveredIndustryNameIsNormalized(string source, string expected)
    {
        Assert.Equal(expected, SecurityMetadataCanonicalizer.NormalizeIndustryName(source));
    }

    [Theory]
    [InlineData("SEMICONDUCTORS", "semiconductors")]
    [InlineData("Software—Infrastructure", "software_infrastructure")]
    [InlineData("ÉLECTRONIQUE & 3D", "electronique_3d")]
    [InlineData("3D Printing", "industry_3d_printing")]
    public void DiscoveredIndustryCodeIsCanonical(string source, string expected)
    {
        Assert.Equal(expected, SecurityMetadataCanonicalizer.NormalizeIndustryCode(source));
    }

    [Fact]
    public void IndustryWithoutLettersOrNumbersIsRejected()
    {
        Assert.Null(SecurityMetadataCanonicalizer.NormalizeIndustryCode("---"));
    }
}
