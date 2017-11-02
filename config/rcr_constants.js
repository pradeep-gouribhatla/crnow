const RCR_CONSTANTS = {
    //basic
    DOMAIN: ".service-now.com",
    table_api_url: "/api/now/v1/table/",
    http_client_timeout: 300000, //5 mins

    //Supported File types
    supported_file_types: ["Script Include", "Client Script", "Business Rule", "Catalog Client Scripts"],

    supported_classes: [
        "sys_script_include",
        "sys_script_client",
        "sys_script"
        //"catalog_script_client",
        //"sysevent_script_action",
        //"sys_ui_script",
        //"sys_ui_page"
    ],

    //folders & config files
    snow_rules_dir: "/snow-rules-git",
    instance_config_file: "config/instance.xml",

    //Snow rules git repo URL
    snow_rules_repo: "https://github.com/pradeep-gouribhatla/snow-rules",

    //scoped app configurtion
    scoped_app_name: "x_snc_sn_rcr_v1",
    scoped_app_search_query: "/api/now/table/sys_app?sysparm_query=scope%3Dx_snc_sn_rcr_v1&sysparm_limit=1",
    //rcr_scoped_git_repo: "https://github.com/pradeep-gouribhatla/sn_rcr_v1",
    rcr_scoped_git_repo: "https://github.com/SN-ITLabs/RcR-CLI",
    scoped_app_api_url: "/api/sn_devstudio/v1/vcs/apps",
    scoped_app_status_uri: "/api/sn_devstudio/v1/vcs/transactions/",

    //system table configuration
    sys_db_obj_url: "/api/now/v1/table/sys_db_object/",
    sys_db_obj_search_query: "/api/now/v1/table/sys_db_object?sysparm_query=name%3Dsys_db_object",

    //admin role verify URL
    snow_update_set_check_url: "/api/now/v1/table/sys_update_set?sysparm_limit=1",

    //update set data
    update_set_api: "/api/now/v1/table/sys_update_xml",
    update_set_api_query: "action!=DELETE^update_set=",
    update_set_api_field_params: "type,name,target_name,payload",

    //scoped app api
    //sys_metadata_list.do?sysparm_query=sys_scope%3D14191d3f4ff48700afef74828110c799
    scoped_app_api: "/api/now/v1/table/sys_metadata?sys_scope=",
    scoped_app_api_query: "sys_scope=",
    scoped_app_api_field_params: "sys_name,sys_id,sys_update_name,sys_class_name",

    //all instance files (when delta is provided)
    //delta_files_api: "/api/now/v1/table/??",
    delta_files_api_query: "sysparm_query=sys_updated_on%3Ejavascript%3Ags.daysAgoStart(__deltadays__)",
    delta_files_api_field_params: "name,type,target_name,payload",

    //tags for file
    file_tags_api: "/api/x_snc_sn_rcr_v1/gettags/process",

    //results
    default_results_template: "/templates/results.hbs",
    default_results_file: "/results/findings.html",

    //max delta days
    max_delta_days: 30,

    //CLI usage info
    USAGE_INS: `
    --configure        >> to configure initial setup 
                       (this also credentials and uploads RCR scoped app if not available) 
    --saveconfig --instance <name> --user <userID> --password <password>
                       >> to save instance details (this will not verify instance data and will not uploadscoped apps)
    --syncrules        >> to sync/update custom and snow rules 
    --update           >> to update rcr setup 
    --reset            >> to reset rcr configurations
    --files '<files array>'      
                       >> to perform code review on file Ids 
                       ex: crnow --file '[{“sysid”:”qajdjf”, “type”:”sys_script”}]'
    --updateset <id>   >> to perform code review on update set files 
    --scopedapp <id>   >> to perform code review on scoped app files
    --duration <days>  >> to perform code review script files which are modified in last delta days
    --help             >> to show all the options `
};

module.exports = RCR_CONSTANTS;
