# crnow

Servicen Now CLI code review tool

---

/ **_| | \ | | / _ \ \ \ / / | _ \ / _**| | \_ \ \_** \ | \| | | | | | \ \ /\ / / ___** | |_) | | | | |_) | **_) | | |\
| | |_| | \ V V / |___**| | \_ < | |**_ | _ < |_\_**/ |_| \_| ___/ \_/\_/ |_| \_\ \___\_| |_| \_\


CRNOW usage instructions below:

    --configure        >> to configure initial setup
                       (this also credentials and uploads RCR scoped app if not available)
    --saveconfig --instance <name> --user <userID> --password <password>
                       >> to save instance details (this will not verify instance data and will not uploadscoped apps)
    --syncrules        >> to sync/update custom and snow rules
    --update           >> to update rcr setup
    --reset            >> to reset rcr configurations
    --files '<files array>'
                       >> to perform code review on file Ids
                       ex: crnow --file '[{“sys_id”:fa919f87c3007236d9f0zwfe961914, “type”:”sys_script”}]'
    --updateset <id>   >> to perform code review on update set files
    --scopedapp <id>   >> to perform code review on scoped app files
    --duration <days>  >> to perform code review script files which are modified in last delta days
    --help             >> to show all the options
