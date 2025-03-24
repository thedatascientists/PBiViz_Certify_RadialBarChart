# Radial Bar Chart
Github repository: https://github.com/thedatascientists/JTA_PBiViz/tree/master/RadialBarChartV5
- Combines the bar chart and the radial chart

### Setting Up Environment

Clone above git repository to a folder on your computer. Then follow the instructions below to install dependencies and run the project.

### Install dev dependencies:

Once you have cloned this example, run these commands to install dependencies and to connect the visual into powerbi.

```
npm install # This command will install all necessary modules
```

### Start dev app
```
on terminal:
pbiviz start
```

### Create new package
```
Change current version on pbiviz.json file (Visual -> version)
on terminal:
pbiviz package
```

### Visual preview
![image](https://github.com/thedatascientists/JTA_PBiViz/assets/57407069/6726bac1-b778-4cf7-8578-005f0d0e1497)
![image](https://github.com/thedatascientists/JTA_PBiViz/assets/57407069/465b2f68-4ea4-44f0-9ecd-0b442721cb88)


### Version History
3.0.0.2 - Visual published in the store

3.0. Small Adjustments - Visual Ready to be Updated in Microsoft Store

2.9 - The visual went to an extensive Stress Testing which resulted in major modification. The main ones were:
      - Packages were updated and Several Settings suffered alterations
      - The format pane was updated and currently the settings are organized by groups and slices
      - The naming and organizaton of the settings was updated
      - Scrolling bars on the horizontal and on the vertical when the size of the visual is too small
      - Option to change the Go Back Icon
      - Changed the direction of the default Go Back icon from the left to the top (to be similar with the default PBI visuals)
      - Created option to move the position of the Go Back icon
      - Added label with category to the Go Back Icon
      - Option to deselect a category on clicking on it or on the blank space around the graph
      - Option to go back when clicking on the blank space
      
1.4.8/1.4.9/1.5 - New visual version for microsoft store:
      - Changed icon
      - Changed default go back icon
      - Reorder multiple settings
      - Changed defaulf values for labels format
      - Added dynamic format option 
      - Added label on target line

1.4.5 - Author name changed on pbiviz.json by request of Microsoft App Source

1.4.4 - Fix quarter values that showed up as 0 when the formatting was set to %

1.4.3 - Multiple new features
      - Splitted text unit formatting content for their respective sub categories (labels, quartes and tooltips)
      - Splitted values for 2 diferent fields: 1st measure and 2nd measure
      - Tooltip on 1st view to show values by group total and categoriy only
      - Added another option for bar color: custom color choosen by user
      - Added new feature to show target by group: draw line for global target (ex: 25%) or individual target by group (ex: A 25%, B 30%, C 60%)
      - Implemented individual total on 1st view

1.4.2 - Updated to API version 2.5 and resolved problems audited when "npm audit"

1.4.1 - Reviewed extra value and description on tooltips to allow both to appear at the same time;
      - Added field on settings to change title of group total value, as it is on the description title
      - Fixed the name of second measure on tooltip, in cases where the second measure is used on drill down

1.4.0 - Allow a second field to measures, with the drill down view coloring only part of the bar instead of coloring it fully (with the purpose of representing %); 
      - Added new setings to change the formatting options of this view

1.3.9 - Added more units formatting options

1.3.8 - Add tooltip custom settings; Allow user to add more than one value to tooltips or add a little description

1.3.7 - Fix filtering when user clicks on first view on specific group (it was filtering only the first category); 
      - Implement selection when user clicks on label instead of bars;
      - Add setting to enable/disable animations and set the time for them;

1.3.6 - Add different display units formatting for labels, tooltips and quarters;

1.3.5 - Visual functional without group or categories; Added context menu functionality;

1.3.4 - Add setting to change label positions (inside or outside bars);

1.3.3 - Updated vertical position of labels (centered aligned before the bars);

1.3.2 - Major changes implemented:
        - Add setting to change the relative max for the visual
        - Add report filtering capability for groups too, complementing the already implemented categories filtering
        - Adjust labels vertical position with the correspondent bars
        - Add setting to adjust label position start (right or left)
        - Add option to format numbers based on cube format
        - Add reference lines for quarters (as is on sonar view)

1.2.1 - Added option to manually change colors on settings;

1.0.2 - Refactoring to the original code. Working version of the visual;
    
