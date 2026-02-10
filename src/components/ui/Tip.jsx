const TIPS = {
  EV: "Equalized Valuation — total assessed property value adjusted by county equalization ratio to a common standard",
  LFS: "Local Fair Share — the portion of adequacy a district is expected to fund from local property taxes and income",
  GCA: "Geographic Cost Adjustment — multiplier reflecting regional cost-of-living differences for school operations",
  CPI: "Consumer Price Index — a measure of average change in prices paid by consumers; used here to inflate the base per-pupil amount annually",
  SpEd: "Special Education — additional funding for students with Individualized Education Programs (IEPs)",
  LEP: "Limited English Proficient — students who are English Language Learners / Multilingual Learners",
  SFRA: "School Funding Reform Act — New Jersey's 2008 education funding law (S-2)",
  IDF: "Income Diversity Factor — a measure of household income spread within a district (1.0 = homogeneous, up to 1.5 = highly diverse)",
  TBI: "Tax Burden Index — property tax levy as a share of aggregate income, scaled so the statewide average equals 1.0",
  UFB: "User Friendly Budget — the adopted operating budget published by NJ DOE for each district, showing revenues, appropriations, and per-pupil costs",
  FRL: "Free/Reduced Lunch — the percentage of students qualifying for the National School Lunch Program, used as a poverty proxy",
  TEV: "True Equalized Valuation — aggregate property value published annually by NJ Division of Taxation",
  PP: "Per Pupil — the dollar amount divided by total enrollment",
  EqAid: "Equalization Aid — the main state aid category, equal to adequacy budget minus local fair share (floored at $0)",
  ESSER: "Elementary and Secondary School Emergency Relief — federal COVID-era funding (ARP/ESSER III) that expired September 2024, creating a fiscal cliff for districts that used it for recurring costs",
  FSI: "Fiscal Stress Index — a composite score (0–100) measuring how many structural warning signs a district exhibits simultaneously",
};

export default function Tip({ term, children }) {
  const tip = TIPS[term];
  if (!tip) return <>{children || term}</>;
  return (
    <span style={{ position: "relative", display: "inline-block" }} title={tip}>
      <span style={{ borderBottom: "1px dashed #5a5848", cursor: "help" }}>{children || term}</span>
    </span>
  );
}
